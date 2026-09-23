import getData from './get-data.js';

const playersCache = {};

export default async function getPlayerList({
  season,
  leagueID = '68362',
  prefix = '',
}) {
  if (playersCache[season]) {
    return playersCache[season];
  }

  try {
    // Get the player list from the MFL API
    const playerListURL = `/${season}/export?TYPE=players&L=${leagueID}&JSON=1`;

    const playerListResponse = await getData(playerListURL);
    const players = playerListResponse.players.player;

    const result = players.map((player) => {
      const [lastName, firstName] = player.name.split(', ');
      player.name = `${firstName} ${lastName}`;
      player.firstName = firstName;
      player.lastName = lastName;
      return player;
    });

    playersCache[season] = result;
    return result;
  } catch (error) {
    return { error };
  }
}
