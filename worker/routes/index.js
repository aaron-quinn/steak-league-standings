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
import tradesYear from './trades.js';
import {
  FINAL_RESPONSE_SECONDS,
  isFinishedSeason,
} from '../utils/season-cache.js';

const CACHE_CONTROL_COPY = 'X-Steak-Cache-Control';

// Cache each finished response at the edge. A hit returns the stored JSON
// without parsing or rebuilding anything, which keeps most requests far inside
// the free plan's CPU limit. Only 200s are cached, so errors are retried.
const cacheFor = (seconds, version = null) => [
  // A response read back from the edge cache arrives with the zone's Browser
  // Cache TTL (4 hours) in place of our Cache-Control, so browsers would keep
  // replaying old live scores to every refetch. Restore our own lifetime,
  // which is saved alongside the response.
  async (c, next) => {
    await next();
    const cacheControl = c.res.headers.get(CACHE_CONTROL_COPY);
    if (!cacheControl) return;
    c.res.headers.set('Cache-Control', cacheControl);
    c.res.headers.delete(CACHE_CONTROL_COPY);
  },
  cache({
    cacheName: 'steak-api',
    // The API takes no query parameters, so ignore them rather than let them
    // bypass the cache
    keyGenerator: (c) => {
      const url = new URL(c.req.path, c.req.url);
      if (version) url.searchParams.set('valuation', version);
      return url.href;
    },
  }),
  // Runs inside the cache middleware, which keeps this header and stores the
  // response for that long. A finished season's responses no longer change.
  async (c, next) => {
    await next();
    // Leave errors uncached, so a browser retries them too. A route may also
    // choose its own lifetime for a particular response.
    if (!c.res.ok) return;
    if (!c.res.headers.has('Cache-Control')) {
      const maxAge = isFinishedSeason(c.req.param('year'))
        ? FINAL_RESPONSE_SECONDS
        : seconds;
      c.header('Cache-Control', `max-age=${maxAge}`);
    }
    c.header(CACHE_CONTROL_COPY, c.res.headers.get('Cache-Control'));
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
// A valuation change must not replay finished-season verdicts from the old model.
apiRoutes.get('/trades/:year', ...cacheFor(300, 'kickoff-v3'), tradesYear);

export default apiRoutes;
