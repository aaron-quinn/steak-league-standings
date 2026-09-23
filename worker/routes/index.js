import { Hono } from 'hono';
import standingsYear from './standings.js';
import liveStandingsYear from './live-standings.js';
import fantasyPointsYear from './points.js';
import playersYear from './players.js';
import liveMatchupsYear from './matchups.js';
import weekYear from './week.js';

const apiRoutes = new Hono();

apiRoutes.get('/standings/:year', standingsYear);
apiRoutes.get('/live-standings/:year', liveStandingsYear);
apiRoutes.get('/points/:year', fantasyPointsYear);
apiRoutes.get('/players/:year', playersYear);
apiRoutes.get('/live-matchups/:year', liveMatchupsYear);
apiRoutes.get('/week/:year', weekYear);

export default apiRoutes;
