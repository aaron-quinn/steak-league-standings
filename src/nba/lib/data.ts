import { useQueries, useQuery } from '@tanstack/react-query';
import type { StatLine } from './roto';
import { CURRENT_SEASON, SEASONS, isFinished } from './season';

// Shapes from worker/nba/espn.js. Finished seasons come from the static
// files in public/nba-data/ (scripts/nba/build-seasons.mjs); the live season
// from the Worker, in the same shapes.

export interface NbaTeam {
  id: number;
  name: string;
  abbrev: string;
  // The person behind the team; '' while a spot has no owner
  owner: string;
  // Season totals through the last day that counts
  totals: StatLine;
  // ESPN's own final roto points and rank, which ignore early cutoffs
  espn: { points: number; rank: number };
}

export interface DraftPick {
  pick: number;
  team: number;
  playerID: number;
  price: number;
  keeper: boolean;
  // How the pick paid off (finished seasons; see buildDraft in moves.ts)
  points?: number;
  games?: number;
  surplus?: number;
}

export interface NbaLeague {
  season: number;
  opener: string;
  finalDay: number;
  latestDay: number;
  // The last day whose games count (the cutoff, in a season that ended early)
  lastDay: number;
  cutoff: string | null;
  budget: number;
  teams: NbaTeam[];
  draft: DraftPick[];
  // Every player seen on a roster (finished seasons only; see useSeasonDays)
  names?: Record<string, string>;
  // Latest NBA affiliation recorded in this season's ESPN snapshots.
  proTeams?: Record<string, number>;
}

// [teamID, playerID, lineup slot, games, ...stat line]
export type PlayerLine = [number, number, number, number, ...number[]];

export interface Transaction {
  type: 'WAIVER' | 'FREEAGENT' | 'TRADE';
  team: number;
  bid: number;
  at: number;
  // [ADD | DROP | TRADE, playerID, from team, to team]
  items: [string, number, number, number][];
}

export interface NbaDay {
  day: number;
  // Each team's active-lineup stat line (live season only)
  teams?: Record<string, StatLine>;
  players: PlayerLine[];
  // Every team's full roster, on days it changed (finished seasons) or every
  // day (live season)
  rosters?: Record<string, number[]>;
  tx: Transaction[];
}

export interface NbaTotals {
  // The days with games that count, and each team's stat line on each
  days: number[];
  teams: Record<string, StatLine[]>;
}

const CHUNK_DAYS = 7;
const LIVE_REFRESH_MS = 60 * 1000;

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

const leagueQuery = (season: number) => ({
  queryKey: ['nba', 'league', season],
  queryFn: () =>
    getJSON<NbaLeague>(
      isFinished(season)
        ? `/nba-data/${season}/league.json`
        : `/api/nba/league/${season}`,
    ),
  staleTime: isFinished(season) ? Infinity : LIVE_REFRESH_MS,
  refetchInterval: isFinished(season) ? (false as const) : LIVE_REFRESH_MS,
});

export const useLeague = (season: number) => useQuery(leagueQuery(season));

// Every season's league, oldest first, for history
export function useAllLeagues(enabled = true) {
  return useQueries({
    queries: [...SEASONS].reverse().map((season) => ({ ...leagueQuery(season), enabled })),
    combine: (results) => ({
      leagues: results.flatMap((r) => (r.data ? [r.data] : [])),
      isPending: enabled && results.some((r) => r.isPending),
    }),
  });
}

// Every finished season's daily lines and moves, for the all-time views. Same
// query keys as useSeasonDays, so a season already opened is reused, and the
// fetch stays off until an all-time view asks for it.
export function useAllTimeDays(enabled = true) {
  const finished = SEASONS.filter(isFinished);
  return useQueries({
    queries: finished.map((season) => ({
      queryKey: ['nba', 'days', season],
      queryFn: () => getJSON<NbaDay[]>(`/nba-data/${season}/days.json`),
      enabled,
      staleTime: Infinity,
    })),
    combine: (results) => ({
      seasons: results.flatMap((r, i) =>
        r.data ? [{ season: finished[i], days: r.data }] : [],
      ),
      isPending: enabled && results.some((r) => r.isPending),
    }),
  });
}

interface Chunk {
  days: NbaDay[];
  names: Record<string, string>;
  proTeams?: Record<string, number>;
}

// The live season, seven days per request. Only the newest chunk changes.
function useLiveChunks(season: number, enabled: boolean) {
  const { data: league } = useLeague(season);
  const lastDay = enabled ? (league?.lastDay ?? 0) : 0;
  const count = Math.ceil(lastDay / CHUNK_DAYS);
  return useQueries({
    queries: Array.from({ length: count }, (_, chunk) => {
      const newest = chunk === count - 1;
      return {
        queryKey: ['nba', 'days', season, chunk],
        queryFn: () => getJSON<Chunk>(`/api/nba/days/${season}/${chunk}`),
        staleTime: newest ? LIVE_REFRESH_MS : Infinity,
        refetchInterval: newest ? LIVE_REFRESH_MS : (false as const),
      };
    }),
    combine: (results) => ({
      chunks: results.flatMap((r) => (r.data ? [r.data] : [])),
      isPending: !league || results.some((r) => r.isPending),
    }),
  });
}

// Every day's player lines and moves, with player names
export function useSeasonDays(season: number) {
  const finished = isFinished(season);
  const { data: league } = useLeague(season);
  const stored = useQuery({
    queryKey: ['nba', 'days', season],
    queryFn: () => getJSON<NbaDay[]>(`/nba-data/${season}/days.json`),
    enabled: finished,
    staleTime: Infinity,
  });
  const live = useLiveChunks(season, !finished);

  if (finished) {
    return {
      days: stored.data,
      names: league?.names ?? {},
      proTeams: league?.proTeams ?? {},
      isPending: stored.isPending || !league,
    };
  }
  return {
    days: live.isPending ? undefined : live.chunks.flatMap((c) => c.days),
    names: Object.assign({}, ...live.chunks.map((c) => c.names)),
    proTeams: Object.assign({}, ...live.chunks.map((c) => c.proTeams)) as Record<string, number>,
    isPending: live.isPending,
  };
}

const totalsQuery = (season: number) => ({
  queryKey: ['nba', 'totals', season],
  queryFn: () => getJSON<NbaTotals>(`/nba-data/${season}/totals.json`),
  staleTime: Infinity,
});

// Each team's stat line for every counted day
export function useSeasonTotals(season: number, enabled = true) {
  const finished = isFinished(season);
  const stored = useQuery({ ...totalsQuery(season), enabled: enabled && finished });
  const live = useLiveChunks(season, enabled && !finished);
  if (finished) return { totals: stored.data, isPending: stored.isPending };
  if (live.isPending) return { totals: undefined, isPending: true };
  return { totals: liveTotals(live.chunks), isPending: false };
}

function liveTotals(chunks: Chunk[]): NbaTotals {
  const days = chunks
    .flatMap((c) => c.days)
    .filter((d) => d.players.length > 0 && d.teams);
  const teams: Record<string, StatLine[]> = {};
  for (const d of days) {
    for (const [id, line] of Object.entries(d.teams!)) {
      (teams[id] ??= []).push(line);
    }
  }
  return { days: days.map((d) => d.day), teams };
}

// Every finished season's daily totals, for the odds model
export function useHistoricalTotals(enabled = true) {
  const finished = SEASONS.filter(isFinished);
  return useQueries({
    queries: finished.map((s) => ({ ...totalsQuery(s), enabled })),
    combine: (results) => ({
      seasons: results.flatMap((r, i) =>
        r.data ? [{ season: finished[i], totals: r.data }] : [],
      ),
      isPending: results.some((r) => r.isPending),
    }),
  });
}

export { CURRENT_SEASON };
