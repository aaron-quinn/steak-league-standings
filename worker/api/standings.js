import getData from './get-data.js';
import sortTeamList from '../utils/sort-team-list.js';
import { seasonDataSeconds } from '../utils/season-cache.js';

// MFL returns a single object rather than a one-item array
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export default async function getStandings({ season, leagueID, prefix = '' }) {
  try {
    // Get the standings from the MFL API
    const weeklyResultsURL = `/${season}/export?TYPE=weeklyResults&L=${leagueID}&W=YTD&JSON=1`;

    const weeklyResultsResponse = await getData(weeklyResultsURL, {
      cacheSeconds: seasonDataSeconds(season, 60),
    });
    const weeklyResults = asList(
      weeklyResultsResponse.allWeeklyResults.weeklyResults,
    );

    const latestResultWeek =
      weeklyResults[weeklyResults.length - 1]?.week || '1';

    const standings = {};
    weeklyResults.forEach((weeklyResult) => {
      const matchups = asList(weeklyResult.matchup); // head-to-head matchups
      const franchises = asList(weeklyResult.franchise); // teams without a weekly matchup
      // MFL can put a team in two playoff games in one week (LA's 2024 week
      // 15), listing the same score twice. It only counts once.
      const scored = new Set();

      // Parse matchups
      matchups.forEach((matchup) => {
        const isRegularSeasonMatchup = (matchup.regularSeason || '0') === '1';
        const teams = asList(matchup.franchise);

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
          if (!scored.has(team.id)) {
            scored.add(team.id);
            standings[`${prefix}${team.id}`].points += Number(team.score || 0);
          }

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
        if (!scored.has(team.id)) {
          scored.add(team.id);
          standings[`${prefix}${team.id}`].points += Number(team.score || 0);
        }
      });
    });

    return { latestResultWeek, standings: sortTeamList(standings, 'points') };
  } catch (error) {
    return { error };
  }
}
