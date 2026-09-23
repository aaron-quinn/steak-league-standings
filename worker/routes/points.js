import getFantasyPoints from '../api/fantasy-points.js';
import getDefaults from '../utils/get-defaults.js';

export default async function fantasyPointsYear(request, reply) {
  const { season: defaultSeason } = getDefaults();
  const season = request.params.year || defaultSeason;

  const playersWithPoints = await getFantasyPoints({ season });

  reply.send(playersWithPoints);
}
