import getPlayers from '../api/players.js';
import getDefaults from '../utils/get-defaults.js';

export default async function fantasyPointsYear(c) {
  const { season: defaultSeason } = getDefaults();
  const season = c.req.param('year') || defaultSeason;

  const players = await getPlayers({ season });

  return c.json(players);
}
