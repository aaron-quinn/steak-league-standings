import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { PlayerPool } from './comps';
import { useLeague, useProjections, useSchedule, useSeasonDays, useSeasonPool } from './data';
import { buildRosters } from './rosters';
import { CURRENT_SEASON } from './season';
import { pointRates } from './value';

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

// The live season's rosters, valued (see rosters.ts). Only the current
// season has rosters to value.
export function useRosters() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const season = CURRENT_SEASON;
  const { data: league } = useLeague(season);
  // Last season's standings set the value of a stat
  const { data: basis } = useLeague(season - 1);
  const { days, names, proTeams, isPending, isError } = useSeasonDays(season);
  const { data: schedule } = useSchedule(season);
  const { data: pool } = useSeasonPool(season);
  // ESPN's projected games and injury status; the page goes on without them
  // if ESPN is slow or down
  const espn = useProjections(season);
  const espnPlayers = espn.data?.players;
  const espnPositions = espn.data?.positions;
  const { data: rw, isPending: rwPending } = useQuery({
    queryKey: ['nba', 'rotowire-availability', season],
    queryFn: () => getJSON<{ season: number; fetchedAt: string | null; fresh: boolean; refreshFailed: boolean; seasonGames: Record<string, number> }>(`/api/nba/rotowire/${season}`),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const age = rw?.fetchedAt ? now - Date.parse(rw.fetchedAt) : Infinity;
  const rwGames = rw?.season === season && rw.fresh && age >= -60_000 && age < 48 * 60 * 60 * 1000 ? rw.seasonGames : undefined;
  // The same queries as usePlayerPool, so these are shared
  const priors = useQueries({
    queries: [season - 1, season - 2].map((s) => ({
      queryKey: ['nba', 'players', s],
      queryFn: () => getJSON<PlayerPool>(`/nba-data/${s}/players.json`),
      staleTime: Infinity,
    })),
    combine: (results) => ({
      pools: results.flatMap((r) => (r.data ? [r.data] : [])),
      isPending: results.some((r) => r.isPending),
    }),
  });

  const model = useMemo(() => {
    if (!league || !basis || !days || isPending || !schedule || !pool || priors.isPending) return undefined;
    return buildRosters({
      league,
      days,
      names,
      proTeams,
      schedule,
      pool,
      priors: priors.pools,
      rates: pointRates(basis),
      espn: espnPlayers,
      positions: espnPositions,
      rotowire: rwGames,
    });
  }, [league, basis, days, isPending, schedule, pool, priors.isPending, priors.pools, names, proTeams, espnPlayers, espnPositions, rwGames]);

  const checked = Number.isFinite(age) ? `${Math.max(0, Math.floor(age / 3_600_000))}h ago` : null;
  const freshness = rwGames
    ? `RotoWire checked ${checked}. Refreshes every 6 hours.${rw?.refreshFailed ? ' Latest refresh failed; using the last successful download.' : ''}`
    : rwPending ? 'Checking RotoWire; using ESPN or historical availability.'
    : `RotoWire ${checked ? `last checked ${checked}` : 'unavailable'}; using ESPN or historical availability.`;
  return { league, model, isError, freshness };
}
