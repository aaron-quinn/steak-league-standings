import { Hono } from 'hono';
import { cache } from 'hono/cache';
import standingsYear from './standings.js';
import liveStandingsYear from './live-standings.js';
import liveMatchupsYear from './matchups.js';
import weekYear from './week.js';
import weeklyScoresYear from './weekly-scores.js';
import weekPlayersYear from './week-players.js';
import waiversYear from './waivers.js';
import draftYear from './draft.js';
import {
  FINAL_RESPONSE_SECONDS,
  isFinishedSeason,
} from '../utils/season-cache.js';

// Cache each finished response at the edge. A hit returns the stored JSON
// without parsing or rebuilding anything, which keeps most requests far inside
// the free plan's CPU limit. Only 200s are cached, so errors are retried.
const cacheFor = (seconds) => [
  cache({
    cacheName: 'steak-api',
    // The API takes no query parameters, so ignore them rather than let them
    // bypass the cache
    keyGenerator: (c) => new URL(c.req.path, c.req.url).href,
  }),
  // Runs inside the cache middleware, which keeps this header and stores the
  // response for that long. A finished season's responses no longer change.
  async (c, next) => {
    await next();
    // Leave errors uncached, so a browser retries them too. A route may also
    // choose its own lifetime for a particular response.
    if (!c.res.ok || c.res.headers.has('Cache-Control')) return;
    const maxAge = isFinishedSeason(c.req.param('year'))
      ? FINAL_RESPONSE_SECONDS
      : seconds;
    c.header('Cache-Control', `max-age=${maxAge}`);
  },
];

const live = cacheFor(30);
const recent = cacheFor(60);
const slow = cacheFor(60 * 5);

const apiRoutes = new Hono();

apiRoutes.get('/standings/:year', ...recent, standingsYear);
apiRoutes.get('/live-standings/:year', ...live, liveStandingsYear);
apiRoutes.get('/live-matchups/:year', ...live, liveMatchupsYear);
apiRoutes.get('/week/:year', ...recent, weekYear);
apiRoutes.get('/weekly-scores/:year', ...recent, weeklyScoresYear);
apiRoutes.get('/week-players/:year/:week', ...slow, weekPlayersYear);
apiRoutes.get('/waivers/:year', ...recent, waiversYear);
apiRoutes.get('/draft/:year', ...slow, draftYear);

export default apiRoutes;
