// API for the NBA season in progress. Finished seasons never reach the Worker:
// the site reads them from public/nba-data/ (scripts/nba/build-seasons.mjs).
//
// ESPN is asked for at most two things a minute per edge location: the league
// (standings, status) and today's scoreboard. A finished day is fetched once,
// reduced to its compact form and kept at the edge for a month.
import { Hono } from 'hono';
import fetchJSON from '../api/fetch-json.js';
import { cacheFor } from '../routes/index.js';
import { FINAL_RESPONSE_SECONDS } from '../utils/season-cache.js';
import { CURRENT_SEASON, ESPN_LEAGUE, OPENERS } from './config.js';
import { DAY_VIEWS, LEAGUE_VIEWS, compactDay, compactLeague } from './espn.js';

export const CHUNK_DAYS = 7;
const LIVE_SECONDS = 60;
const FINAL_DAY_SECONDS = 60 * 60 * 24 * 30;

const getLeague = async (season) =>
  compactLeague(
    await fetchJSON(`${ESPN_LEAGUE(season)}?${LEAGUE_VIEWS}`, {
      cacheSeconds: LIVE_SECONDS,
    }),
  );

// The compact day, from the edge cache when we have it. A warm instance keeps
// it in memory too.
const memory = new Map();
async function getDay(season, day, final) {
  const key = `https://nba.steak.internal/day/v2/${season}/${day}`;
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
  const league = await getLeague(season);
  return c.json({
    ...league,
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
    days: days.map(({ day, teams, players, rosters, tx }) => ({ day, teams, players, rosters, tx })),
    names,
    proTeams,
  });
});

export default nba;
