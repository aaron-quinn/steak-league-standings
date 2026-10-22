import { useQueries, useQuery } from '@tanstack/react-query';
import type { PlayerPool } from './comps';
import type { StatLine } from './roto';
import type { NbaSchedule } from './schedule';
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
  // Season totals through the last day that counts (live season: including
  // games played today)
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
  // The team that nominated the player (missing in files built before it was kept)
  nominator?: number;
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
  // Live season: days in `totals` from the live box scores, which ESPN's
  // season totals haven't taken in yet
  liveDays?: number[];
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
  // Every rostered player's lineup slot (live season only)
  slots?: Record<string, number>;
  // The NBA team each rostered player who played that day played for (live)
  playedFor?: Record<string, number>;
  // Each team's active-lineup minutes, on days with games
  minutes?: Record<string, number>;
  tx: Transaction[];
}

// An NBA game on the latest scoring day (worker/nba/espn.js compactGames)
export interface NbaGame {
  home: number;
  away: number;
  state: 'pre' | 'in' | 'post';
  // "Final", "3:15 - 1st", "10/21 - 7:30 PM EDT"
  detail: string;
  start: string;
}

export interface Tonight {
  day: number;
  date: string;
  games: NbaGame[];
}

export interface NbaTotals {
  // The days with games that count, and each team's stat line on each
  days: number[];
  teams: Record<string, StatLine[]>;
  // Games each team's active lineup played on each of those days (files built
  // since Oct 2026, and the live season)
  games?: Record<string, number[]>;
}

const CHUNK_DAYS = 7;

// Browsers keep /nba-data/ for an hour (public/_headers), so bump this when
// build-seasons.mjs changes days.json's shape to fetch the new files at once.
// 2: each day's team minutes.
const DAYS_VERSION = 2;
const daysFile = (season: number) => `/nba-data/${season}/days.json?v=${DAYS_VERSION}`;
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
      queryFn: () => getJSON<NbaDay[]>(daysFile(season)),
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

const chunkQuery = (season: number, chunk: number, newest: boolean) => ({
  queryKey: ['nba', 'days', season, chunk],
  queryFn: () => getJSON<Chunk>(`/api/nba/days/${season}/${chunk}`),
  staleTime: newest ? LIVE_REFRESH_MS : Infinity,
  refetchInterval: newest ? LIVE_REFRESH_MS : (false as const),
});

// The live season, seven days per request. Only the newest chunk changes.
function useLiveChunks(season: number, enabled: boolean) {
  const { data: league } = useLeague(season);
  const lastDay = enabled ? (league?.lastDay ?? 0) : 0;
  const count = Math.ceil(lastDay / CHUNK_DAYS);
  return useQueries({
    queries: Array.from({ length: count }, (_, chunk) =>
      chunkQuery(season, chunk, chunk === count - 1),
    ),
    combine: (results) => ({
      chunks: results.flatMap((r) => (r.data ? [r.data] : [])),
      isPending: !league || results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
    }),
  });
}

// The live season's latest day alone, from the newest chunk (the same query
// useLiveChunks makes, so pages share it)
export function useToday(season: number) {
  const { data: league } = useLeague(season);
  const latestDay = !isFinished(season) ? (league?.latestDay ?? 0) : 0;
  const chunk = Math.floor((latestDay - 1) / CHUNK_DAYS);
  const { data } = useQuery({ ...chunkQuery(season, chunk, true), enabled: latestDay > 0 });
  return {
    day: data?.days.find((d) => d.day === latestDay),
    names: data?.names ?? {},
    proTeams: data?.proTeams ?? {},
  };
}

// ESPN's season projections summed over each team's current roster (IR left
// out), from worker/nba/espn.js compactProjections
export interface NbaProjections {
  teams: { id: number; totals: StatLine; players: number; missing: number }[];
}

export const useProjections = (season: number, enabled = true) =>
  useQuery({
    queryKey: ['nba', 'projections', season],
    queryFn: () => getJSON<NbaProjections>(`/api/nba/projections/${season}`),
    enabled: enabled && !isFinished(season),
    staleTime: 60 * 60 * 1000,
  });

// The live season's per-game lines say little until about ten games in, so
// comps use last season's until then
const COMP_DAYS = 21;

// Every NBA player's season totals to find comps in: a finished season's own,
// or the live season's once it is three weeks old
export function usePlayerPool(season: number, enabled = true) {
  const { data: league } = useLeague(season);
  const live = !isFinished(season);
  const own = !live || (league?.latestDay ?? 0) >= COMP_DAYS;
  const from = own ? season : season - 1;
  return useQuery({
    queryKey: ['nba', 'players', from],
    queryFn: () =>
      getJSON<PlayerPool>(
        isFinished(from) ? `/nba-data/${from}/players.json` : `/api/nba/players/${from}`,
      ),
    enabled: enabled && (!live || Boolean(league)),
    staleTime: isFinished(from) ? Infinity : 60 * 60 * 1000,
  });
}

// The NBA games on the live season's latest day
export const useTonight = (season: number) =>
  useQuery({
    queryKey: ['nba', 'tonight', season],
    queryFn: () => getJSON<Tonight>(`/api/nba/tonight/${season}`),
    enabled: !isFinished(season),
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: LIVE_REFRESH_MS,
  });

// Every day's player lines and moves, with player names
export function useSeasonDays(season: number, enabled = true) {
  const finished = isFinished(season);
  const { data: league } = useLeague(season);
  const stored = useQuery({
    queryKey: ['nba', 'days', season],
    queryFn: () => getJSON<NbaDay[]>(daysFile(season)),
    enabled: enabled && finished,
    staleTime: Infinity,
  });
  const live = useLiveChunks(season, enabled && !finished);

  if (finished) {
    return {
      days: stored.data,
      names: league?.names ?? {},
      proTeams: league?.proTeams ?? {},
      isPending: stored.isPending || !league,
      isError: stored.isError,
    };
  }
  return {
    days: live.isPending ? undefined : live.chunks.flatMap((c) => c.days),
    names: Object.assign({}, ...live.chunks.map((c) => c.names)),
    proTeams: Object.assign({}, ...live.chunks.map((c) => c.proTeams)) as Record<string, number>,
    isPending: live.isPending,
    isError: live.isError,
  };
}

const totalsQuery = (season: number) => ({
  queryKey: ['nba', 'totals', season],
  // v2: each day's games (see DAYS_VERSION)
  queryFn: () => getJSON<NbaTotals>(`/nba-data/${season}/totals.json?v=2`),
  staleTime: Infinity,
});

// The live season's NBA schedule by day
export const useSchedule = (season: number, enabled = true) =>
  useQuery({
    queryKey: ['nba', 'schedule', season],
    queryFn: () => getJSON<NbaSchedule>(`/api/nba/schedule/${season}`),
    enabled: enabled && !isFinished(season),
    staleTime: 60 * 60 * 1000,
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
  const games: Record<string, number[]> = {};
  for (const d of days) {
    const played: Record<string, number> = {};
    for (const [team, , slot, count] of d.players) {
      if (slot !== 12 && slot !== 13) played[team] = (played[team] ?? 0) + count;
    }
    for (const [id, line] of Object.entries(d.teams!)) {
      (teams[id] ??= []).push(line);
      (games[id] ??= []).push(played[id] ?? 0);
    }
  }
  return { days: days.map((d) => d.day), teams, games };
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
