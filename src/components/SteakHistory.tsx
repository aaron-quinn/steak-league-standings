import { useMemo } from 'react';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import type { SteakManager } from '../types/SteakManager';
import type { TeamYear } from '../types/TeamYear';

export default function SteakHistory() {
  const year = useStandingsStore((state) => state.year);

  const managersList = useMemo(() => {
    const managers = getManagers();

    // Steaks go to the top half of the league, so a season with no steak
    // winners at all has not been scored yet. Leave it out until it is, or an
    // unplayed season counts as a missed steak against everyone.
    const isCurrentSeasonScored = managers.some((m) => m.teams[year]?.steak);

    const steakManagers = managers
      .filter((t) => t.teams[year] && 'steak' in t.teams[year])
      .map((t) => {
        const teamYear = t.teams[year];
        const league = teamYear.league || '';
        const teamID = teamYear.teamID || '';
        const division = teamYear.division || '';
        const id = `${league.toLowerCase()}${teamID}`;
        return {
          id,
          name: t.name,
          league,
          division,
          teamID,
          teams: t.teams,
        };
      });

    const list: SteakManager[] = steakManagers
      .map((m) => {
        const countedTeams = Object.entries(m.teams)
          .filter(
            ([teamYear]) => isCurrentSeasonScored || Number(teamYear) !== year,
          )
          .map(([, teamYear]) => teamYear) as TeamYear[];
        const numSteaks = countedTeams.reduce(
          (acc, t) => acc + (t.steak ? 1 : 0),
          0,
        );
        return {
          name: m.name,
          numSteaks,
          steaks: countedTeams.map((t) => t.steak),
          missedSteaks: countedTeams.filter((t) => 'steak' in t && !t.steak),
          steaksWidth: `${20 * numSteaks}px`,
        };
      })
      .filter((m) => m.steaks.length > 0);

    list.sort((a, b) => {
      if (a.numSteaks === b.numSteaks) {
        return a.missedSteaks.length - b.missedSteaks.length;
      }
      return b.numSteaks - a.numSteaks;
    });

    return list;
  }, [year]);

  return (
    <div className="w-full antialiased py-2 sm:py-2.5">
      <div className="grid grid-cols-[auto_1fr] gap-x-2 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 px-2.5 sm:px-3">
        {managersList.map((manager) => (
          <div key={manager.name} className="contents">
            <div className="text-xs sm:text-sm">
              {[...Array(manager.numSteaks)].map((_, i) => (
                <span key={`steak-${i}`} className="opacity-70">
                  🥩
                </span>
              ))}
              {manager.missedSteaks.map((_, i) => (
                <span key={`missed-${i}`} className="opacity-40">
                  🪦
                </span>
              ))}
            </div>
            <div className="text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 text-gray-300">
              <span className="truncate">{manager.name.split(' ')[1]}</span>
              <span className="text-gray-500 text-[10px] sm:text-xs font-mono tabular-nums shrink-0">
                {Math.round(
                  (100 * manager.numSteaks) /
                    (manager.numSteaks + manager.missedSteaks.length),
                )}
                %
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
