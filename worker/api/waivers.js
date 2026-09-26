import getData from './get-data.js';
import { seasonDataSeconds } from '../utils/season-cache.js';

// Settings and the NFL schedule change rarely mid-season
const SETTINGS_CACHE_SECONDS = 60 * 60 * 12;

// MFL returns a single object rather than a one-item array
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

// MFL lists player IDs as "12345,67890,"
const idList = (value = '') => value.split(',').filter(Boolean);

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

  const pickups = [];
  const departures = [];
  asList(response.transactions?.transaction).forEach((move) => {
    const time = Number(move.timestamp) * 1000;
    const franchiseID = `${prefix}${move.franchise}`;

    if (move.type === 'BBID_WAIVER' || move.type === 'FREE_AGENT') {
      // Won bids are "added|bid|dropped", free agent moves "added|dropped"
      const parts = (move.transaction || '').split('|');
      const bid = move.type === 'BBID_WAIVER';
      const cost = bid ? Number(parts[1]) || 0 : 0;
      const dropped = idList(bid ? parts[2] : parts[1]);
      idList(parts[0]).forEach((playerID, index) =>
        pickups.push({
          franchiseID,
          playerID,
          time,
          bid,
          // One bid, however many players it brings in
          cost: index === 0 ? cost : 0,
          dropped,
        }),
      );
      dropped.forEach((playerID) =>
        departures.push({ franchiseID, playerID, time, drop: true }),
      );
    } else if (move.type === 'TRADE') {
      idList(move.franchise1_gave_up).forEach((playerID) =>
        departures.push({ franchiseID, playerID, time, drop: false }),
      );
      idList(move.franchise2_gave_up).forEach((playerID) =>
        departures.push({
          franchiseID: `${prefix}${move.franchise2}`,
          playerID,
          time,
          drop: false,
        }),
      );
    }
  });

  const byTime = (a, b) => a.time - b.time;
  return { pickups: pickups.sort(byTime), departures: departures.sort(byTime) };
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
