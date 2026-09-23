import getPlayers from '../api/players.js';
import getDefaults from '../utils/get-defaults.js';

export default async function fantasyPointsYear(request, reply) {
  const { season: defaultSeason } = getDefaults();
  const season = request.params.year || defaultSeason;

  const players = await getPlayers({ season });

  reply.send(players);
}
