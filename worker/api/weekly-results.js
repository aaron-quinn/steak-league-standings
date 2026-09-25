import getData from './get-data.js';

// MFL returns a single object rather than a one-item array
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

// Every played week of a league's season, with each team's score and roster.
// Uses the same export as the standings, so the two share a cached copy.
export default async function getWeeklyResults({ season, leagueID, prefix }) {
  try {
    const weeklyResultsURL = `/${season}/export?TYPE=weeklyResults&L=${leagueID}&W=YTD&JSON=1`;
    const response = await getData(weeklyResultsURL, { cacheSeconds: 60 });

    const weeks = [];
    asList(response.allWeeklyResults?.weeklyResults).forEach((result) => {
      const franchises = [
        ...asList(result.matchup).flatMap((matchup) =>
          asList(matchup.franchise),
        ),
        ...asList(result.franchise),
      ];

      // MFL lists the whole schedule up front. Only a played week has scores.
      const played = franchises.some(
        (team) => team.score !== undefined && team.score !== '',
      );
      if (!played) return;

      const teams = {};
      franchises.forEach((team) => {
        teams[`${prefix}${team.id}`] = {
          score: Number(team.score || 0),
          players: asList(team.player).map((player) => ({
            id: player.id,
            score: Number(player.score || 0),
            starter: player.status === 'starter',
          })),
        };
      });

      weeks.push({ week: Number(result.week), teams });
    });

    return { weeks };
  } catch (error) {
    return { error };
  }
}
