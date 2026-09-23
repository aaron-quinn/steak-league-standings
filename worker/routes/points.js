import getFantasyPoints from '../api/fantasy-points.js';
import getDefaults from '../utils/get-defaults.js';

export default async function fantasyPointsYear(c) {
  const { season: defaultSeason } = getDefaults();
  const season = c.req.param('year') || defaultSeason;

  const playersWithPoints = await getFantasyPoints({ season });

  return c.json(playersWithPoints);
}
