import { useMemo } from 'react';
import { useSteakJudge } from '@/hooks/useSteakJudge';
import {
  getDeficits,
  getTombstoneLine,
  getWeekComebacks,
  isTombstoned,
} from '@/utils/steak-odds';

// The teams the Steak Odds screen has tombstoned after the latest finished
// week, from the same history and line. Empty until every season loads.
export function useTombstoned(year: number) {
  const { judge } = useSteakJudge(year);

  return useMemo(() => {
    const tombstoned = new Set<string>();
    if (!judge) return tombstoned;
    const { pastYears, model, season } = judge.judged(year);
    const played = season.weeks.length;
    if (played === 0) return tombstoned;
    const history = pastYears.map((past) => ({
      year: past,
      season: judge.judged(past).season,
    }));
    const line = getTombstoneLine(
      getWeekComebacks(history, model.seasonWeeks),
    );
    getDeficits(season, played).forEach((deficit, id) => {
      if (isTombstoned(deficit, played, line, model.seasonWeeks)) {
        tombstoned.add(id);
      }
    });
    return tombstoned;
  }, [judge, year]);
}
