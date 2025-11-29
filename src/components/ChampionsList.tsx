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
    <ul className="w-full antialiased text-sm py-3">
      {championsList.map((manager) => (
        <li
          key={`${manager.name}-${manager.year}`}
          className="px-4 py-1.5 w-full flex items-center hover:bg-navy-900/30 transition-colors"
        >
          <span className="w-12 text-accent-500 font-mono font-medium">{manager.year}</span>
          <span className="text-navy-200 font-medium">{manager.name}</span>
        </li>
      ))}
    </ul>
  );
}
