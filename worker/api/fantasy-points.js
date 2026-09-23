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

    const fantasyPtsResponse = await getData(fantasyPtsURL);
    const playerList = await getPlayers({ season });

    const playersWithPoints = fantasyPtsResponse.playerScores.playerScore;

    // Match up the array of players with points to the array of players from the MFL API
    const players = playerList.map((player) => {
      const mflPlayer = playersWithPoints.find((p) => p.id === player.id);
      return {
        ...player,
        points: mflPlayer?.score || 0,
      };
    });
    return players;
  } catch (error) {
    return { error };
  }
}
