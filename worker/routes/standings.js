import getStandings from '../api/standings.js';
import getDefaults from '../utils/get-defaults.js';
import sortTeamList from '../utils/sort-team-list.js';

export default async function standingsYear(request, reply) {
  const { season: defaultSeason, leagues } = getDefaults();
  const season = request.params.year || defaultSeason;

  const teamList = {};

  for (const league of leagues) {
    const {
      latestResultWeek,
      standings: teams,
      error: standingsError,
    } = await getStandings({
      season,
      leagueID: league.id,
      prefix: `${league.name}`,
    });

    // MFL rate limits (429) and getStandings reports that by returning only an
    // error, so `teams` is undefined here rather than carrying an error flag.
    if (standingsError || !teams) {
      request.log.error(
        standingsError,
        `Unable to load ${season} standings for ${league.name}`,
      );
      reply.code(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: `Unable to load standings for the ${season} season.`,
      });
      return;
    }

    Object.entries(teams).forEach((team) => {
      const [teamID, teamData] = team;
      teamList[teamID] = teamData;
    });
  }

  // Round points for each team in standings
  Object.values(teamList).forEach((team) => {
    team.points = Math.round(team.points * 10) / 10;
  });

  reply.send(sortTeamList(teamList, 'points'));
}
