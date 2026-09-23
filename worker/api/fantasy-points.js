import getData from './get-data.js';
import getPlayers from './players.js';

export default async function getFantasyPoints({
  season,
  leagueID = '68362',
  prefix = '',
}) {
  try {
    // Get the fantasy points from the MFL API
    const fantasyPtsURL = `/${season}/export?TYPE=playerScores&L=${leagueID}&W=YTD&YEAR=${season}&JSON=1`;

    const fantasyPtsResponse = await getData(fantasyPtsURL, {
      cacheSeconds: 60 * 5,
    });
    const playerList = await getPlayers({ season });

    const playersWithPoints = fantasyPtsResponse.playerScores.playerScore;

    // Match up the array of players with points to the array of players from
    // the MFL API. A lookup keeps this within the Workers CPU budget.
    const pointsByID = new Map(playersWithPoints.map((p) => [p.id, p.score]));
    const players = playerList.map((player) => {
      return {
        ...player,
        points: pointsByID.get(player.id) || 0,
      };
    });
    return players;
  } catch (error) {
    return { error };
  }
}
