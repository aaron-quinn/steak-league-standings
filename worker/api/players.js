import getData from './get-data.js';

// Player details change rarely
const PLAYERS_CACHE_SECONDS = 60 * 60 * 12;

// MFL names players "Last, First"
function withSplitName(player) {
  const [lastName, firstName] = player.name.split(', ');
  return {
    ...player,
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
  };
}

// MFL returns a single object rather than a one-item array
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

// Players who appear in a liveScoring export, by MFL ID. Asking MFL for just
// those players returns about a tenth of the full list, which keeps rebuilding
// the live endpoints within the free plan's CPU limit. Rosters rarely change
// within a week, so the same request is usually served from the edge cache.
export async function getLiveScoringPlayers({ season, liveScoring }) {
  const franchises = [
    ...asList(liveScoring.matchup).flatMap((matchup) =>
      asList(matchup.franchise),
    ),
    ...asList(liveScoring.franchise),
  ];
  const ids = new Set(
    franchises.flatMap((franchise) =>
      asList(franchise.players?.player).map((player) => player.id),
    ),
  );
  return getPlayersByID({ season, ids });
}

// Every player MFL lists for the season, by MFL ID. Ten times the size of a
// live scoring request's players, but still quick to parse, and only the
// draft values need it: finding each position's baseline means knowing the
// position of every player who has scored, drafted or not.
export async function getAllPlayers({ season }) {
  const playersURL = `/${season}/export?TYPE=players&JSON=1`;
  const playersResponse = await getData(playersURL, {
    cacheSeconds: PLAYERS_CACHE_SECONDS,
  });

  return new Map(
    asList(playersResponse.players?.player).map((player) => [
      player.id,
      withSplitName(player),
    ]),
  );
}

// Details for just the given MFL player IDs, by ID
export async function getPlayersByID({ season, ids }) {
  if (ids.size === 0) {
    return new Map();
  }

  try {
    const playersURL = `/${season}/export?TYPE=players&PLAYERS=${[...ids].sort().join(',')}&JSON=1`;
    const playersResponse = await getData(playersURL, {
      cacheSeconds: PLAYERS_CACHE_SECONDS,
    });

    return new Map(
      asList(playersResponse.players?.player).map((player) => [
        player.id,
        withSplitName(player),
      ]),
    );
  } catch (error) {
    // Without details the players still show, by ID
    return new Map();
  }
}
