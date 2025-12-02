import { useMemo } from 'react';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';

export default function WeeklyScoreRanking() {
  const year = useStandingsStore((state) => state.year);
  const standings = useStandingsStore((state) => state.standings);
  const live = useStandingsStore((state) => state.live);

  const ranking = useMemo(() => {
    if (!live) return [];
    const managers = getManagers();

    const list = managers
      .map((manager) => {
        const teamYear = manager.teams[year];
        if (
          !teamYear ||
          !teamYear.teamID ||
          !teamYear.league ||
          !('steak' in teamYear)
        ) {
          return null;
        }

        const id = `${teamYear.league.toLowerCase()}${teamYear.teamID}`;
        const teamData = standings[id];

        if (!teamData) return null;

        return {
          name: manager.name,
          score: teamData.weeklyScore || 0,
        };
      })
      .filter((item): item is { name: string; score: number } => item !== null);

    list.sort((a, b) => b.score - a.score);

    return list;
  }, [year, standings]);

  if (ranking.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-800/60 pt-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2 sm:px-3">
        Weekly Leaders
      </h3>
      <div className="space-y-0.5">
        {ranking.map((item, index) => (
          <div
            key={item.name}
            className="flex items-center justify-between px-2 sm:px-3 py-1 text-xs hover:bg-white/5 rounded transition-colors"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-gray-500 w-3 sm:w-4 text-right font-mono text-[10px] sm:text-xs">
                {index + 1}
              </span>
              <span className="text-gray-300 truncate max-w-[120px] sm:max-w-none">
                {item.name}
              </span>
            </div>
            <span className="font-mono text-emerald-400">
              {item.score.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
