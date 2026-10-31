import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { PlayerPool } from './comps';
import { useAllLeagues, useLeague, useSchedule, useSeasonDays } from './data';
import { buildInjuryData, type InjuryData } from './injuries';
import { SEASONS, isFinished } from './season';

// 2018 was played on Yahoo: no daily lineups
const FIRST_INJURY_SEASON = 2019;

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

const storedQuery = (season: number, enabled = true) => ({
  queryKey: ['nba', 'injuries', season],
  queryFn: () => getJSON<InjuryData>(`/nba-data/${season}/injuries.json?v=2`),
  enabled: enabled && isFinished(season) && season >= FIRST_INJURY_SEASON,
  staleTime: Infinity,
});

// Finished seasons' totals for every NBA player (the same query as usePlayerPool)
const poolQuery = (season: number, enabled: boolean) => ({
  queryKey: ['nba', 'players', season],
  queryFn: () => getJSON<PlayerPool>(`/nba-data/${season}/players.json`),
  enabled: enabled && season >= FIRST_INJURY_SEASON,
  staleTime: Infinity,
});

export const hasInjuries = (season: number) => season >= FIRST_INJURY_SEASON;

// A season's absences: built once for finished seasons
// (scripts/nba/build-injuries.mjs), from the live days for the current one
export function useInjuries(season: number) {
  const live = !isFinished(season);
  const stored = useQuery(storedQuery(season));
  const { data: league } = useLeague(season);
  const { days, names, proTeams, isPending } = useSeasonDays(season, live);
  const { data: schedule } = useSchedule(season, live);
  const priors = useQueries({
    queries: [season - 1, season - 2].map((s) => poolQuery(s, live)),
    combine: (results) => ({
      pools: results.flatMap((r) => (r.data ? [r.data] : [])),
      isPending: results.some((r) => r.isPending && r.fetchStatus !== 'idle'),
    }),
  });

  const built = useMemo(() => {
    if (!live || !league || !days || isPending || !schedule || priors.isPending) return undefined;
    // Today's games may still be on: count through yesterday
    const through = Math.min(league.latestDay - 1, league.lastDay);
    return buildInjuryData({ days, schedule, through, names, proTeams, priors: priors.pools });
  }, [live, league, days, isPending, schedule, priors.isPending, priors.pools, names, proTeams]);

  return live
    ? { league, data: built, names, proTeams, isPending: !built }
    : {
        league,
        data: stored.data,
        names: league?.names ?? {},
        proTeams: league?.proTeams ?? {},
        isPending: !league || stored.isPending,
      };
}

// Every finished season's absences, for the all-time view
export function useAllInjuries(enabled: boolean) {
  const { leagues, isPending: leaguesPending } = useAllLeagues(enabled);
  const finished = SEASONS.filter((s) => isFinished(s) && s >= FIRST_INJURY_SEASON);
  const results = useQueries({
    queries: finished.map((s) => storedQuery(s, enabled)),
    combine: (rs) => ({
      seasons: rs.flatMap((r, i) => (r.data ? [{ season: finished[i], data: r.data }] : [])),
      isPending: rs.some((r) => r.isPending),
    }),
  });
  return {
    seasons: results.seasons.flatMap(({ season, data }) => {
      const league = leagues.find((l) => l.season === season);
      return league ? [{ season, data, league }] : [];
    }),
    isPending: enabled && (leaguesPending || results.isPending),
  };
}
