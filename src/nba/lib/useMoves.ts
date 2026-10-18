import { useMemo } from 'react';
import { useLeague, useSeasonDays } from './data';
import { pointRates } from './value';

// A season's league, every day's lines and moves, and its roto point rates
export function useMoves(season: number) {
  const { data: league } = useLeague(season);
  const { days, names, proTeams, isPending } = useSeasonDays(season);
  const rates = useMemo(() => (league ? pointRates(league) : null), [league]);
  return {
    league,
    days,
    names,
    proTeams,
    rates,
    ready: Boolean(league && days && rates && !isPending),
  };
}
