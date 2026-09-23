import getData from './get-data.js';

// The player list changes rarely and is MFL's largest export
const PLAYERS_CACHE_SECONDS = 60 * 60 * 12;

export default async function getPlayerList({
  season,
  leagueID = '68362',
  prefix = '',
}) {
  try {
    // Get the player list from the MFL API
    const playerListURL = `/${season}/export?TYPE=players&L=${leagueID}&JSON=1`;

    const playerListResponse = await getData(playerListURL, {
      cacheSeconds: PLAYERS_CACHE_SECONDS,
    });
    const players = playerListResponse.players.player;

    const result = players.map((player) => {
      const [lastName, firstName] = player.name.split(', ');
      player.name = `${firstName} ${lastName}`;
      player.firstName = firstName;
      player.lastName = lastName;
      return player;
    });

    return result;
  } catch (error) {
    return { error };
  }
}
