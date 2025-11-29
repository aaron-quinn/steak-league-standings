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
    <ul className="w-full antialiased text-sm py-2">
      {championsList.map((manager) => (
        <li
          key={`${manager.name}-${manager.year}`}
          className="px-3 py-0.5 w-full text-slate-400 font-light flex items-center"
        >
          <span className="w-10 text-slate-500">{manager.year}</span>
          <span>{manager.name}</span>
        </li>
      ))}
    </ul>
  );
}
