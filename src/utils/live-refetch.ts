// Matches the Worker's cache for live scoring, so a refetch sooner than this
// would only get the same answer back
const PLAYING_MS = 30_000;
// Often enough to notice a kickoff without polling all week between games
const WAITING_MS = 5 * 60_000;

interface LiveCounts {
  yetToPlay?: number;
  inProgress?: number;
}

// How often to refetch live scores given each team's game counts: every 30s
// while games are being played, every 5 minutes while games are still to come,
// and not at all once the week is final
export function liveRefetchInterval(teams: LiveCounts[]): number | false {
  if (teams.some((team) => (team.inProgress ?? 0) > 0)) return PLAYING_MS;
  if (teams.some((team) => (team.yetToPlay ?? 0) > 0)) return WAITING_MS;
  return false;
}
