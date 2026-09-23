import getData from './get-data.js';
import sortTeamList from '../utils/sort-team-list.js';

export default async function getStandings({ season, leagueID, prefix = '' }) {
  try {
    // Get the standings from the MFL API
    const weeklyResultsURL = `/${season}/export?TYPE=weeklyResults&L=${leagueID}&W=YTD&JSON=1`;

    const weeklyResultsResponse = await getData(weeklyResultsURL);
    const weeklyResults = weeklyResultsResponse.allWeeklyResults.weeklyResults;

    const latestResultWeek =
      weeklyResults[weeklyResults.length - 1]?.week || '1';

    const standings = {};
    weeklyResults.forEach((weeklyResult) => {
      const matchups = weeklyResult.matchup || []; // array of head-to-head matchups
      const franchises = weeklyResult.franchise || []; // array of teams without a weekly matchup

      // Parse matchups
      matchups.forEach((matchup) => {
        const isRegularSeasonMatchup = (matchup.regularSeason || '0') === '1';
        const teams = matchup.franchise || [];

        // MFL pre-populates the entire schedule before the season starts and
        // marks every unplayed game as a tie. Only a game that has actually
        // been played carries a score, so use that to tell them apart.
        const hasBeenPlayed = teams.some(
          (team) => team.score !== undefined && team.score !== '',
        );

        teams.forEach((team) => {
          // Initialize team in standings if not present
          if (!standings[`${prefix}${team.id}`]) {
            standings[`${prefix}${team.id}`] = {
              points: 0,
              wins: 0,
              losses: 0,
              ties: 0,
            };
          }

          // Add to running tally of points for
          standings[`${prefix}${team.id}`].points += Number(team.score || 0);

          // Only count wins/losses/ties for regular season games once played
          if (isRegularSeasonMatchup && hasBeenPlayed) {
            standings[`${prefix}${team.id}`].wins += team.result == 'W' ? 1 : 0;
            standings[`${prefix}${team.id}`].losses +=
              team.result == 'L' ? 1 : 0;
            standings[`${prefix}${team.id}`].ties += team.result == 'T' ? 1 : 0;
          }
        });
      });

      // Parse franchises
      franchises.forEach((team) => {
        // Initialize team in standings if not present
        if (!standings[`${prefix}${team.id}`]) {
          standings[`${prefix}${team.id}`] = {
            points: 0,
            wins: 0,
            losses: 0,
            ties: 0,
          };
        }

        // Add to running tally of points for
        standings[`${prefix}${team.id}`].points += Number(team.score || 0);
      });
    });

    return { latestResultWeek, standings: sortTeamList(standings, 'points') };
  } catch (error) {
    return { error };
  }
}
