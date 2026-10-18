import { useMemo } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { getStandings } from '@/api';
import { getWeeklyScores } from '@/api/fun';
import { FIRST_SEASON } from './useSteakJudge';
import type { StandingsData } from '@/types/StandingsData';
import type { WeeklyScores } from '@/types/Fun';
import { buildCareers } from '@/utils/manager-careers';

function combine<T>(results: UseQueryResult<T>[]) {
  return {
    data: results.map((result) => result.data),
    isError: results.some((result) => result.isError),
    isPending: results.some((result) => result.isPending),
  };
}

// Every manager's career: each season's weekly scores (for steak ranks) and
// standings (for records). Records fill in when they arrive; the careers
// wait only on the scores.
export function useCareers(currentYear: number) {
  const years = useMemo(
    () =>
      Array.from(
        { length: currentYear - FIRST_SEASON + 1 },
        (_, i) => currentYear - i,
      ),
    [currentYear],
  );
  const scores = useQueries({
    queries: years.map((year) => ({
      queryKey: ['weekly-scores', year],
      queryFn: () => getWeeklyScores(year),
    })),
    combine: combine<WeeklyScores[]>,
  });
  const standings = useQueries({
    queries: years.map((year) => ({
      // Shared with the official standings view
      queryKey: ['standings', year, false],
      queryFn: () => getStandings(`/standings/${year}`),
    })),
    combine: combine<StandingsData>,
  });

  const careers = useMemo(() => {
    if (scores.data.some((weeks) => !weeks)) return null;
    const byYear = <T>(data: (T | undefined)[]) =>
      new Map(
        years.flatMap((year, i) =>
          data[i] ? [[year, data[i] as T] as const] : [],
        ),
      );
    return buildCareers(
      currentYear,
      byYear(scores.data),
      byYear(standings.data),
    );
  }, [scores.data, standings.data, years, currentYear]);

  return { careers, isError: scores.isError, isPending: scores.isPending };
}
