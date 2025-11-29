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
    <div className="hidden lg:block">
      <div className="bg-slate-700 text-slate-300 py-2 px-4 rounded-t-md font-bold">
        Madison Steak Leaderboard
        <span className="text-sm pl-2 font-thin">Since 2016</span>
      </div>
      <ul className="w-full antialiased text-lg bg-slate-800 py-3 rounded-b-md mb-8">
        {managersList.map((manager) => (
          <li
            key={manager.name}
            className="px-4 w-full text-slate-300 font-light flex justify-between shadow-2xl items-center"
          >
            <div className="flex items-center leading-6 text-sm gap-x-3">
              <div className="flex items-center justify-start w-[140px] tracking-wider">
                {[...Array(manager.numSteaks)].map((_, i) => (
                  <div key={`steak-${i}`}>🥩</div>
                ))}
                {manager.missedSteaks.map((_, i) => (
                  <div key={`missed-${i}`} className="opacity-10">
                    🥩
                  </div>
                ))}
              </div>
              <div>
                {manager.name.split(' ')[1]}
                <span className="text-slate-400 text-xs font-thin ml-1.5 inline-block">
                  {Math.round(
                    (100 * manager.numSteaks) /
                      (manager.numSteaks + manager.missedSteaks.length),
                  ).toFixed(0)}
                  %
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
