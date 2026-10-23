// API for the NBA season in progress. Finished seasons never reach the Worker:
// the site reads them from public/nba-data/ (scripts/nba/build-seasons.mjs).
//
// ESPN is asked for at most three things a minute per edge location: the
// league (standings, status), today's fantasy scoreboard and today's NBA
// games, plus rosters with projections once an hour. A finished day is
// fetched once, reduced to its compact form and kept at the edge for a month.
import { Hono } from 'hono';
import fetchJSON from '../api/fetch-json.js';
import { cacheFor } from '../routes/index.js';
import { FINAL_RESPONSE_SECONDS } from '../utils/season-cache.js';
import { CURRENT_SEASON, ESPN_LEAGUE, OPENERS, dateOfDay } from './config.js';
import { addLine, scoreRoto } from '../../src/nba/lib/roto.ts';
import {
  DAY_VIEWS,
  LEAGUE_VIEWS,
  PLAYERS_FILTER,
  PLAYERS_VIEWS,
  ROSTER_VIEWS,
  SCHEDULE,
  SCOREBOARD,
  compactDay,
  compactGames,
  compactLeague,
  compactPlayers,
  compactProjections,
  compactSchedule,
} from './espn.js';

export const CHUNK_DAYS = 7;
const LIVE_SECONDS = 60;
const FINAL_DAY_SECONDS = 60 * 60 * 24 * 30;

const fetchLeague = (season) =>
  fetchJSON(`${ESPN_LEAGUE(season)}?${LEAGUE_VIEWS}`, {
    cacheSeconds: LIVE_SECONDS,
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
// it in memory too.
const memory = new Map();
async function getDay(season, day, final) {
  const key = `https://nba.steak.internal/day/v6/${season}/${day}`;
  const kept = memory.get(key);
  if (kept && kept.expires > Date.now()) return kept.data;

  const cache = caches.default;
  const cached = await cache.match(key);
  if (cached) {
    const expires = Number(cached.headers.get('X-Expires'));
    if (expires > Date.now()) {
      const data = await cached.json();
      memory.set(key, { data, expires });
      return data;
    }
  }

  // No point keeping ESPN's full response: only the compact form is reused
  const json = await fetchJSON(
    `${ESPN_LEAGUE(season)}?${DAY_VIEWS}&scoringPeriodId=${day}`,
  );
  const data = compactDay(json, day);
  const seconds = final ? FINAL_DAY_SECONDS : LIVE_SECONDS;
  const expires = Date.now() + seconds * 1000;
  await cache.put(
    key,
    new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${seconds}`,
        'X-Expires': String(expires),
      },
    }),
  );
  memory.set(key, { data, expires });
  return data;
}

const isCurrent = (year) => Number(year) === CURRENT_SEASON;

const nba = new Hono();

nba.get('/league/:year', ...cacheFor(LIVE_SECONDS), async (c) => {
  const season = Number(c.req.param('year'));
  if (!isCurrent(season)) return c.json({ error: 'Not the current season' }, 404);
  const json = await fetchLeague(season);
  const league = compactLeague(json);
  const { totals, added } = await liveTotals(season, league, json);
  return c.json({
    ...league,
    teams: league.teams.map((team) => ({ ...team, totals: totals.get(team.id) })),
    // Days whose stats come from the live box scores, not ESPN's totals
    liveDays: added,
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
