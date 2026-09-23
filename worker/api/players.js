import getData from './get-data.js';

// The player list changes rarely and is MFL's largest export
const PLAYERS_CACHE_SECONDS = 60 * 60 * 12;

// Parsing the list and indexing it is the costliest part of a live request, so
// keep the result for as long as this Worker instance stays warm. Both leagues
// share it, as they share the same player pool.
const loaded = {};

async function loadPlayers(season, leagueID) {
  const cached = loaded[season];
  if (cached && cached.expires > Date.now()) {
    return cached;
  }

  // Get the player list from the MFL API
  const playerListURL = `/${season}/export?TYPE=players&L=${leagueID}&JSON=1`;

  const playerListResponse = await getData(playerListURL, {
    cacheSeconds: PLAYERS_CACHE_SECONDS,
  });
  const players = playerListResponse.players.player;

  // Build new objects rather than renaming in place: the parsed response is
  // shared with other requests (see fetch-json.js)
  const list = players.map((player) => {
    const [lastName, firstName] = player.name.split(', ');
    return {
      ...player,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
    };
  });
  const byID = new Map(list.map((player) => [player.id, player]));

  loaded[season] = {
    list,
    byID,
    expires: Date.now() + PLAYERS_CACHE_SECONDS * 1000,
  };
  return loaded[season];
}

export default async function getPlayerList({
  season,
  leagueID = '68362',
  prefix = '',
}) {
  try {
    const { list } = await loadPlayers(season, leagueID);
    return list;
  } catch (error) {
    return { error };
  }
}

// Players by MFL ID. Treat the entries as read-only: they are shared.
export async function getPlayerMap({ season, leagueID = '68362' }) {
  try {
    const { byID } = await loadPlayers(season, leagueID);
    return byID;
  } catch (error) {
    return new Map();
  }
}
