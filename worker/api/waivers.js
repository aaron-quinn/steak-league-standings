import getData from './get-data.js';
import { seasonDataSeconds } from '../utils/season-cache.js';
import { parseRosterMoves } from '../utils/roster-moves.js';

// Settings and the NFL schedule change rarely mid-season
const SETTINGS_CACHE_SECONDS = 60 * 60 * 12;

// MFL returns a single object rather than a one-item array
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

// A league's roster moves for the season, oldest first: every pickup (a won
// blind bid or a free agent signing) and every player who left a team by being
// dropped or traded
export async function getRosterMoves({ season, leagueID, prefix }) {
  const url = `/${season}/export?TYPE=transactions&L=${leagueID}&JSON=1`;
  const response = await getData(url, {
    cacheSeconds: seasonDataSeconds(season, 60),
  });
  if (response.error) {
    throw new Error(
      `MFL transactions error: ${JSON.stringify(response.error)}`,
    );
  }

  return parseRosterMoves(response.transactions?.transaction, prefix);
}

// The season's blind bidding budget for each team, if the league has one
export async function getWaiverBudget({ season, leagueID }) {
  const url = `/${season}/export?TYPE=league&L=${leagueID}&JSON=1`;
  const response = await getData(url, {
    cacheSeconds: seasonDataSeconds(season, SETTINGS_CACHE_SECONDS),
  });
  return Number(response.league?.bbidSeasonLimit) || null;
}

// When each NFL week's last game kicks off, oldest first. A player added
// before then can still play for his new team that week.
export async function getWeekDeadlines(season) {
  const url = `/${season}/export?TYPE=nflSchedule&W=ALL&JSON=1`;
  const response = await getData(url, {
    cacheSeconds: seasonDataSeconds(season, SETTINGS_CACHE_SECONDS),
  });
  return asList(response.fullNflSchedule?.nflSchedule)
    .map((week) => ({
      week: Number(week.week),
      deadline: Math.max(
        ...asList(week.matchup).map((game) => Number(game.kickoff) * 1000),
      ),
    }))
    .filter(({ deadline }) => Number.isFinite(deadline) && deadline > 0)
    .sort((a, b) => a.week - b.week);
}
