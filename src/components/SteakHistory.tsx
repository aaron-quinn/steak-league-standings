import { useMemo } from 'react';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import type { SteakManager } from '../types/SteakManager';
import type { TeamYear } from '../types/TeamYear';

export default function SteakHistory() {
  const year = useStandingsStore((state) => state.year);

  const managersList = useMemo(() => {
    const managers = getManagers();

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
        const teams = Object.values(m.teams) as TeamYear[];
        const teamsWithoutCurrent = teams.slice(0, -1);
        const numSteaks = teamsWithoutCurrent.reduce(
          (acc, t) => acc + (t.steak ? 1 : 0),
          0,
        );
        return {
          name: m.name,
          numSteaks,
          steaks: teamsWithoutCurrent.map((t) => t.steak),
          missedSteaks: teamsWithoutCurrent.filter(
            (t) => 'steak' in t && !t.steak,
          ),
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
    <ul className="w-full antialiased py-3">
      {managersList.map((manager) => (
        <li
          key={manager.name}
          className="px-4 py-1.5 w-full text-navy-200 font-normal flex items-center gap-3 hover:bg-navy-900/30 transition-colors"
        >
          <div className="flex items-center justify-start min-w-[100px] text-sm tracking-tight">
            {[...Array(manager.numSteaks)].map((_, i) => (
              <span key={`steak-${i}`}>🥩</span>
            ))}
            {manager.missedSteaks.map((_, i) => (
              <span key={`missed-${i}`} className="opacity-25 grayscale">
                🥩
              </span>
            ))}
          </div>
          <div className="text-sm flex items-center gap-2">
            <span className="font-medium">{manager.name.split(' ')[1]}</span>
            <span className="text-accent-500/70 text-xs font-mono">
              {Math.round(
                (100 * manager.numSteaks) /
                  (manager.numSteaks + manager.missedSteaks.length),
              )}
              %
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
