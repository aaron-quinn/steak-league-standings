import { useMemo } from 'react';
import getManagers from '../data/managers';
import type { ChampionItem } from '../types/ChampionItem';
import type { Manager } from '../types/Manager';

export default function ChampionsList() {
  const championsList = useMemo(() => {
    const managers = getManagers();

    // Find champion managers for each year
    const champions = managers.filter((m: Manager) => {
      return Object.values(m.teams).some((t) => t.champion);
    });

    const championsWithYears = champions.map((c) => {
      const years: string[] = [];
      Object.keys(c.teams).forEach((y) => {
        if (c.teams[Number(y)].champion) {
          years.push(y);
        }
      });
      return { name: c.name, years };
    });

    const list: ChampionItem[] = [];
    championsWithYears.forEach((c) => {
      c.years.forEach((y) => {
        list.push({ name: c.name, year: y });
      });
    });

    list.sort((a, b) => Number(b.year) - Number(a.year));
    return list;
  }, []);

  return (
    <div className="hidden lg:block">
      <div className="bg-slate-700 text-slate-300 py-2 px-4 rounded-t-md font-bold">
        Champions
      </div>
      <ul className="w-full antialiased text-base bg-slate-800 py-3 rounded-b-md mb-6">
        {championsList.map((manager) => (
          <li
            key={`${manager.name}-${manager.year}`}
            className="px-4 w-full text-slate-300 font-light flex justify-between shadow-2xl items-center"
          >
            <div className="flex items-center leading-7">
              <div className="w-7 mr-3">{manager.year}</div>
              <div className="ml-2">{manager.name}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
