import { Hono } from 'hono';
import { cache } from 'hono/cache';
import standingsYear from './standings.js';
import liveStandingsYear from './live-standings.js';
import fantasyPointsYear from './points.js';
import playersYear from './players.js';
import liveMatchupsYear from './matchups.js';
import weekYear from './week.js';

// Cache each finished response at the edge. A hit returns the stored JSON
// without parsing or rebuilding anything, which keeps most requests far inside
// the free plan's CPU limit. Only 200s are cached, so errors are retried.
const cacheFor = (seconds) =>
  cache({
    cacheName: 'steak-api',
    cacheControl: `max-age=${seconds}`,
    // The API takes no query parameters, so ignore them rather than let them
    // bypass the cache
    keyGenerator: (c) => new URL(c.req.path, c.req.url).href,
  });

const live = cacheFor(30);
const recent = cacheFor(60);
const slow = cacheFor(60 * 5);

const apiRoutes = new Hono();

apiRoutes.get('/standings/:year', recent, standingsYear);
apiRoutes.get('/live-standings/:year', live, liveStandingsYear);
apiRoutes.get('/points/:year', slow, fantasyPointsYear);
apiRoutes.get('/players/:year', slow, playersYear);
apiRoutes.get('/live-matchups/:year', live, liveMatchupsYear);
apiRoutes.get('/week/:year', recent, weekYear);

export default apiRoutes;
