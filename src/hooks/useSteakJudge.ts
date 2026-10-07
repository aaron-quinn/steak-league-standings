import { useMemo } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { getWeeklyScores } from '@/api/fun';
import type { WeeklyScores } from '@/types/Fun';
import { buildSteakSeason, type SteakSeason } from '@/utils/steak-season';
import {
  fitScoringModel,
  simulateSteakOdds,
  weeksInSeason,
  type ScoringModel,
  type SteakOdds,
} from '@/utils/steak-odds';

// Seasons with both leagues in the managers data
export const FIRST_SEASON = 2016;

// Kept outside the hook so the combined data only changes when a season's
// scores do
function combineSeasons(results: UseQueryResult<WeeklyScores[]>[]) {
  return {
    data: results.map((result) => result.data),
    isError: results.some((result) => result.isError),
    isPending: results.some((result) => result.isPending),
  };
}

// Every season's scores, and a judge for any one of them: its standings and
// model, and its odds after each week. The model comes from every finished
// season except the one asked for, so a past season is judged as if it
// hadn't happened yet. Each is built once, along with its odds after each
// week, simulated the first time they're asked for, so stepping through
// weeks, switching seasons or opening a team's story doesn't rerun them.
export function useSteakJudge(currentYear: number, enabled = true) {
  const { data, isError, isPending } = useQueries({
    queries: Array.from(
      { length: currentYear - FIRST_SEASON + 1 },
      (_, i) => currentYear - i,
    ).map((season) => ({
      queryKey: ['weekly-scores', season],
      queryFn: () => getWeeklyScores(season),
      enabled,
    })),
    combine: combineSeasons,
  });

  const judge = useMemo(() => {
    if (data.some((weeks) => !weeks)) return null;
    const scores = (season: number) =>
      data[currentYear - season] as WeeklyScores[];
    const seasons = new Map<
      number,
      {
        pastYears: number[];
        model: ScoringModel;
        season: SteakSeason;
        odds: Map<number, Map<string, SteakOdds>>;
      }
    >();
    const judged = (year: number) => {
      let judgedSeason = seasons.get(year);
      if (!judgedSeason) {
        const pastYears = Array.from(
          { length: currentYear - FIRST_SEASON },
          (_, i) => FIRST_SEASON + i,
        ).filter((season) => season !== year);
        judgedSeason = {
          pastYears,
          model: {
            ...fitScoringModel(pastYears.map(scores)),
            // Played out to this season's length, not the longest past one
            seasonWeeks: weeksInSeason(year),
          },
          season: buildSteakSeason(year, scores(year)),
          odds: new Map(),
        };
        seasons.set(year, judgedSeason);
      }
      return judgedSeason;
    };
    const oddsFor = (year: number, week: number) => {
      const { season, model, odds } = judged(year);
      let weekOdds = odds.get(week);
      if (!weekOdds) {
        weekOdds = simulateSteakOdds(season, week, model);
        odds.set(week, weekOdds);
      }
      return weekOdds;
    };
    return { judged, oddsFor };
  }, [data, currentYear]);

  return { judge, isError, isPending };
}
