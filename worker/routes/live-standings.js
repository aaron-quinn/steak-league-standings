import getStandings from '../api/standings.js';
import getLiveScores from '../api/live-scores.js';
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

    const {
      scores: liveScores,
      error: liveError,
      matchups,
      week,
    } = await getLiveScores({
      season,
      leagueID: league.id,
      prefix: `${league.name}`,
    });

    Object.entries(teamList).map((team) => {
      const [teamID, teamData] = team;

      if (liveError || !liveScores) {
        return team;
      }

      const liveData = liveScores[teamID];
      if (!liveData) {
        return team;
      }

      teamList[teamID] = teamData;
      teamList[teamID].points =
        latestResultWeek == week
          ? Number(teamData.points)
          : Number(teamData.points) + Number(liveData.score);
      teamList[teamID].points = (
        Math.round(teamList[teamID].points * 100) / 100
      ).toFixed(2);

      teamList[teamID].weeklyScore = Number(liveData.score);
      teamList[teamID].yetToPlay = liveData.yetToPlay;
      teamList[teamID].inProgress = liveData.inProgress;
      teamList[teamID].yetToPlayNames = liveData.yetToPlayNames;
      teamList[teamID].inProgressNames = liveData.inProgressNames;

      return team;
    });

    if (week <= 14 && matchups) {
      matchups.forEach((matchup) => {
        const franchise1 = matchup.franchise[0];
        const franchise2 = matchup.franchise[1];
        const id1 = `${league.name}${franchise1.id}`;
        const id2 = `${league.name}${franchise2.id}`;
        const score1 = Number(franchise1.score);
        const score2 = Number(franchise2.score);

        if (teamList[id1] && teamList[id2]) {
          const team1 = teamList[id1];
          const team2 = teamList[id2];
          const gamesPlayed1 = team1.wins + team1.losses + team1.ties;
          const gamesPlayed2 = team2.wins + team2.losses + team2.ties;

          if (gamesPlayed1 === week || gamesPlayed2 === week) {
            return;
          }

          if (score1 > score2) {
            teamList[id1].wins++;
            teamList[id2].losses++;
          } else if (score2 > score1) {
            teamList[id2].wins++;
            teamList[id1].losses++;
          } else {
            teamList[id1].ties++;
            teamList[id2].ties++;
          }
        }
      });
    }
  }

  // Round points for each team in standings
  Object.values(teamList).forEach((team) => {
    team.points = Math.round(team.points * 10) / 10;
    team.weeklyScore = Math.round(team.weeklyScore * 10) / 10;
  });

  reply.send(sortTeamList(teamList, 'points'));
}
