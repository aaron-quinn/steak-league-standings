// API for the NBA season in progress. Finished seasons never reach the Worker:
// the site reads them from public/nba-data/ (scripts/nba/build-seasons.mjs).
//
// While NBA games are on, ESPN is asked for at most three things a minute per
// edge location: the league (standings, status), today's fantasy scoreboard and
// today's NBA games. The rest of the day, when only lineup moves and
// transactions change anything, the fantasy API is asked once every ten
// minutes. Rosters with projections are fetched once an hour. A finished day is
// fetched once, reduced to its compact form and kept at the edge for a month.
import { Hono } from 'hono';
import fetchJSON, { isCoolingDown } from '../api/fetch-json.js';
import { cacheFor } from '../routes/index.js';
import { FINAL_RESPONSE_SECONDS } from '../utils/season-cache.js';
import { BENCH, CURRENT_SEASON, ESPN_LEAGUE, FIRST_SEASON, IR, OPENERS, dateOfDay } from './config.js';
import { addLine, scoreRoto } from '../../src/nba/lib/roto.ts';
import {
  DAY_VIEWS,
  GAMELOG,
  LEAGUE_VIEWS,
  PLAYERS_FILTER,
  PLAYERS_VIEWS,
  ROSTER_VIEWS,
  SCHEDULE,
  SCOREBOARD,
  compactDay,
  compactGameLog,
  compactGames,
  compactLeague,
  compactPlayers,
  compactProjections,
  compactSchedule,
} from './espn.js';

export const CHUNK_DAYS = 7;
const LIVE_SECONDS = 60;
const FINAL_DAY_SECONDS = 60 * 60 * 24 * 30;
// A live day's compact form is kept this long past its lifetime, to serve when
// ESPN fails
const STALE_DAY_SECONDS = 60 * 60 * 24;

// With no game on, the live data only changes with lineup moves and
// transactions, which can wait this long to show
const QUIET_SECONDS = 60 * 10;
// Back to a minute this long before the next tip-off
const TIP_OFF_LEAD_MS = 10 * 60 * 1000;

// The NBA night it is in Eastern time. Games end before 6am and start after
// it, so a game running past midnight still belongs to the night it started.
const nbaNight = (now) =>
  new Date(now - 6 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  });

// How long ESPN's live fantasy data can be cached right now: a minute while a
// game is on or about to start, longer when nothing is happening. Usually the
// same scoreboard request as /games, so this costs ESPN nothing extra.
async function liveSeconds() {
  let games;
  try {
    games = compactGames(
      await fetchJSON(SCOREBOARD(nbaNight(Date.now())), { cacheSeconds: LIVE_SECONDS }),
    );
  } catch {
    return LIVE_SECONDS;
  }
  if (games.some((game) => game.state === 'in')) return LIVE_SECONDS;
  // A game past its start time that hasn't begun (a delay) counts as about to
  const starts = games
    .filter((game) => game.state === 'pre')
    .map((game) => Date.parse(game.start))
    .filter(Number.isFinite);
  const untilSoon = (Math.min(...starts) - TIP_OFF_LEAD_MS - Date.now()) / 1000;
  return Math.max(LIVE_SECONDS, Math.min(QUIET_SECONDS, Math.floor(untilSoon)));
}

const fetchLeague = async (season) =>
  fetchJSON(`${ESPN_LEAGUE(season)}?${LEAGUE_VIEWS}`, {
    cacheSeconds: await liveSeconds(),
  });

const getLeague = async (season) => compactLeague(await fetchLeague(season));

// ESPN's season totals only take in a day overnight, after its games are
// over, but its live roto points (pointsLive) move as games are played. Put
// the days it hasn't taken in yet on top of its totals, and use the live
// points to tell which days those are: the candidate whose roto points match
// them, or failing that the closest (the league and the day are cached
// separately, so mid-game they can be a minute apart).
async function liveTotals(season, league, json) {
  const latest = league.latestDay;
  const pointsLive = new Map(
    (json.teams ?? []).map((team) => [team.id, team.pointsLive ?? 0]),
  );
  const official = new Map(league.teams.map((team) => [team.id, team.totals]));
  if (!latest) return { totals: official, added: [] };

  const today = await getDay(season, latest, false);
  const yesterday =
    latest > 1 ? await getDay(season, latest - 1, true) : null;
  const candidates = [
    [],
    [today],
    ...(yesterday ? [[yesterday, today]] : []),
  ].map((days) => {
    const totals = new Map();
    for (const [id, line] of official) {
      const sum = [...line];
      for (const day of days) addLine(sum, day.teams[id] ?? []);
      totals.set(id, sum);
    }
    const miss = scoreRoto(totals).reduce(
      (total, team) => total + Math.abs(team.points - (pointsLive.get(team.id) ?? 0)),
      0,
    );
    return { totals, added: days.map((day) => day.day), miss };
  });
  // Ties go to the fewest added days, so nothing is counted twice
  return candidates.reduce((best, c) => (c.miss < best.miss - 1e-6 ? c : best));
}

// The compact day, from the edge cache when we have it. A warm instance keeps
// it in memory too, and requests arriving together (/league and /days both
// want today) share one ESPN fetch.
const memory = new Map();
const loading = new Map();
async function getDay(season, day, final) {
  const key = `https://nba.steak.internal/day/v6/${season}/${day}`;
  const kept = memory.get(key);
  if (kept && kept.expires > Date.now()) return kept.data;

  let request = loading.get(key);
  if (!request) {
    request = loadDay(key, season, day, final).finally(() => loading.delete(key));
    loading.set(key, request);
  }
  return request;
}

async function loadDay(key, season, day, final) {
  const cache = caches.default;
  const cached = await cache.match(key);
  const cachedText = cached ? await cached.text() : null;
  const cachedExpires = Number(cached?.headers.get('X-Expires')) || 0;
  if (cachedText !== null && cachedExpires > Date.now()) {
    const data = JSON.parse(cachedText);
    memory.set(key, { data, expires: cachedExpires });
    return data;
  }

  // ESPN throttled or stalled a moment ago: the last copy beats an error
  const url = `${ESPN_LEAGUE(season)}?${DAY_VIEWS}&scoringPeriodId=${day}`;
  if (cachedText !== null && isCoolingDown(url)) return JSON.parse(cachedText);

  const seconds = final ? FINAL_DAY_SECONDS : liveSeconds();
  // No point keeping ESPN's full response: only the compact form is reused
  let json;
  try {
    json = await fetchJSON(url);
  } catch (error) {
    if (cachedText === null) throw error;
    console.warn(`Serving a stale copy of day ${day}: ${error.message}`);
    return JSON.parse(cachedText);
  }
  const data = compactDay(json, day);
  const expires = Date.now() + (await seconds) * 1000;
  await cache.put(
    key,
    new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${(await seconds) + (final ? 0 : STALE_DAY_SECONDS)}`,
        'X-Expires': String(expires),
      },
    }),
  );
  memory.set(key, { data, expires });
  return data;
}

// Adds the active-lineup games each team played on a day (bench and IR don't
// count) into a tally, as the odds count them (src/nba/lib/data.ts liveTotals)
function addGames(tally, day) {
  for (const [team, , slot, games] of day.players) {
    if (slot !== BENCH && slot !== IR) tally[team] = (tally[team] ?? 0) + games;
  }
}

// Days added to the tally per request, at most. Each can cost an ESPN fetch,
// and a request may only make 50 subrequests on the free plan, so a tally that
// has to start over (the season's first request, or a lost key) catches up a
// few days a minute rather than in one burst.
const BACKFILL_DAYS = 5;

// Each team's active-lineup games so far, today's included, for today's odds,
// which project per game played. Finished days are tallied once, in KV
// ({ throughDay, games }), so this never re-reads the season: each new day
// adds one. null while the tally is still catching up, or when this
// location's league is a different day from the one the tally reached; the
// site then counts the games from every day's lines itself.
async function gamesPlayed(env, season, latestDay) {
  const kv = env?.NBA;
  if (!kv || latestDay < 1) return null;
  const key = `played/v1/${season}`;
  let tally = (await kv.get(key, 'json')) ?? { throughDay: 0, games: {} };
  const finished = latestDay - 1;
  if (tally.throughDay < finished) {
    const days = [];
    const last = Math.min(finished, tally.throughDay + BACKFILL_DAYS);
    for (let day = tally.throughDay + 1; day <= last; day++) days.push(day);
    const games = { ...tally.games };
    for (const day of await Promise.all(days.map((d) => getDay(season, d, true)))) {
      addGames(games, day);
    }
    tally = { throughDay: last, games };
    await kv.put(key, JSON.stringify(tally));
  }
  if (tally.throughDay !== finished) return null;
  const games = { ...tally.games };
  addGames(games, await getDay(season, latestDay, false));
  return games;
}

const isCurrent = (year) => Number(year) === CURRENT_SEASON;

const nba = new Hono();

nba.get('/league/:year', ...cacheFor(LIVE_SECONDS), async (c) => {
  const season = Number(c.req.param('year'));
  if (!isCurrent(season)) return c.json({ error: 'Not the current season' }, 404);
  const json = await fetchLeague(season);
  const league = compactLeague(json);
  const { totals, added } = await liveTotals(season, league, json);
  // A missing tally only costs the site some speed, so it never fails the page
  const games = await gamesPlayed(c.env, season, league.latestDay).catch((error) => {
    console.warn(`No games played tally: ${error.message}`);
    return null;
  });
  return c.json({
    ...league,
    teams: league.teams.map((team) => ({ ...team, totals: totals.get(team.id) })),
    // Days whose stats come from the live box scores, not ESPN's totals
    liveDays: added,
    ...(games && { games }),
    opener: OPENERS[season],
    cutoff: null,
    lastDay: league.latestDay,
  });
});

// Seven days at a time: chunk 0 is days 1–7. Days that haven't started are
// left out. A chunk of finished days no longer changes.
nba.get('/days/:year/:chunk', ...cacheFor(LIVE_SECONDS), async (c) => {
  const season = Number(c.req.param('year'));
  const chunk = Number(c.req.param('chunk'));
  if (!isCurrent(season) || !Number.isInteger(chunk) || chunk < 0) {
    return c.json({ error: 'Unknown season or chunk' }, 404);
  }
  const { latestDay, finalDay } = await getLeague(season);
  const first = chunk * CHUNK_DAYS + 1;
  const last = Math.min(first + CHUNK_DAYS - 1, latestDay, finalDay);
  const ids = [];
  for (let day = first; day <= last; day++) ids.push(day);

  const days = await Promise.all(
    ids.map((day) => getDay(season, day, day < latestDay)),
  );
  const names = {};
  const proTeams = {};
  for (const day of days) Object.assign(names, day.names);
  for (const day of days) Object.assign(proTeams, day.proTeams);

  const final = first + CHUNK_DAYS - 1 < latestDay;
  if (final) c.header('Cache-Control', `max-age=${FINAL_RESPONSE_SECONDS}`);
  return c.json({
    days: days.map(
      ({ day, teams, players, rosters, slots, minutes, playerMinutes, playedFor, tx }) => ({
        day,
        teams,
        players,
        rosters,
        slots,
        minutes,
        playerMinutes,
        playedFor,
        tx,
      }),
    ),
    names,
    proTeams,
  });
});

// The NBA schedule by day, for the weekly games view. It changes only when
// games are rescheduled.
const SCHEDULE_SECONDS = 60 * 60 * 24;
nba.get('/schedule/:year', ...cacheFor(SCHEDULE_SECONDS), async (c) => {
  const season = Number(c.req.param('year'));
  if (!isCurrent(season)) return c.json({ error: 'Not the current season' }, 404);
  const json = await fetchJSON(SCHEDULE(season), { cacheSeconds: SCHEDULE_SECONDS });
  return c.json(compactSchedule(json));
});

// Each team's summed ESPN season projections over its current roster, for the
// Builds page's projected shapes. Rosters change with moves, projections
// rarely, so an hour is fresh enough.
const PROJECTION_SECONDS = 60 * 60;
nba.get('/projections/:year', ...cacheFor(PROJECTION_SECONDS), async (c) => {
  const season = Number(c.req.param('year'));
  if (!isCurrent(season)) return c.json({ error: 'Not the current season' }, 404);
  const json = await fetchJSON(`${ESPN_LEAGUE(season)}?${ROSTER_VIEWS}`, {
    cacheSeconds: PROJECTION_SECONDS,
  });
  return c.json(compactProjections(json, season));
});

// Every NBA player's season totals so far, for the per-game player comps.
// Totals only move overnight, so a few hours is fresh enough.
const PLAYERS_SECONDS = 60 * 60 * 3;
nba.get('/players/:year', ...cacheFor(PLAYERS_SECONDS), async (c) => {
  const season = Number(c.req.param('year'));
  if (!isCurrent(season)) return c.json({ error: 'Not the current season' }, 404);
  const json = await fetchJSON(`${ESPN_LEAGUE(season)}?${PLAYERS_VIEWS}`, {
    cacheSeconds: PLAYERS_SECONDS,
    headers: { 'X-Fantasy-Filter': PLAYERS_FILTER(season) },
  });
  return c.json(compactPlayers(json.players?.map((p) => p.player) ?? [], season));
});

// One player's every NBA game in a season, for the player pages. Unlike the
// rest of this file it serves finished seasons too: the stored days only hold
// games played while on a league roster. Lines only move overnight.
const GAMELOG_SECONDS = 60 * 60 * 3;
nba.get('/gamelog/:year/:id', ...cacheFor(GAMELOG_SECONDS), async (c) => {
  const season = Number(c.req.param('year'));
  const id = Number(c.req.param('id'));
  if (season < FIRST_SEASON || season > CURRENT_SEASON || !Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'No such player or season' }, 404);
  }
  const finished = season < CURRENT_SEASON;
  const json = await fetchJSON(GAMELOG(season, id), {
    cacheSeconds: finished ? FINAL_DAY_SECONDS : GAMELOG_SECONDS,
  });
  if (finished) c.header('Cache-Control', `max-age=${FINAL_RESPONSE_SECONDS}`);
  return c.json(compactGameLog(json));
});

// The NBA games on the latest scoring day (or an earlier one, /games/:year/N),
// with whether each is still to come, being played or over. The day is in the
// path because the API cache ignores query strings. (This was /tonight/:year
// until a ?day= version poisoned that cache entry with a past day's games.)
const games = async (c) => {
  const season = Number(c.req.param('year'));
  if (!isCurrent(season)) return c.json({ error: 'Not the current season' }, 404);
  const { latestDay } = await getLeague(season);
  const asked = Number(c.req.param('day'));
  const past = Number.isInteger(asked) && asked >= 1 && asked < latestDay;
  const day = past ? asked : Math.max(1, latestDay);
  const date = dateOfDay(season, day);
  const seconds = past ? FINAL_DAY_SECONDS : LIVE_SECONDS;
  const list = compactGames(await fetchJSON(SCOREBOARD(date), { cacheSeconds: seconds }));
  if (past) c.header('Cache-Control', `max-age=${FINAL_RESPONSE_SECONDS}`);
  return c.json({ day, date, games: list });
};
nba.get('/games/:year', ...cacheFor(LIVE_SECONDS), games);
nba.get('/games/:year/:day', ...cacheFor(LIVE_SECONDS), games);

export default nba;
