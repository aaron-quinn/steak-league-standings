import getData from './get-data.js';
import { seasonDataSeconds } from '../utils/season-cache.js';

// MFL returns a single object rather than a one-item array
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

// Every player's points under one league's scoring, by MFL ID, for one week or
// ('YTD') the season so far. Covers free agents too, not just rostered
// players. The season so far includes any week in progress.
export default async function getPlayerScores({ season, leagueID, week }) {
  const scoresURL = `/${season}/export?TYPE=playerScores&L=${leagueID}&W=${week}&JSON=1`;
  const response = await getData(scoresURL, {
    cacheSeconds: seasonDataSeconds(season, 60 * 5),
  });

  // MFL answers with an error for a week it has no scores for, such as the
  // week after the season ends
  return new Map(
    asList(response.playerScores?.playerScore).map((player) => [
      player.id,
      Number(player.score) || 0,
    ]),
  );
}
