// Tombstones, the NFL site's rule applied to roto: a team is buried when it
// sits further behind the last eating spot than any team that went on to eat
// has ever been, at that point of a season or later. Seasons differ in
// length, so they line up by weeks left, as the NFL page does.
import type { Race } from './race';

// Roto points each team trails the last eating spot by (0 for eaters)
export function deficits(race: Race, week: number) {
  const eaters = Math.floor(race.teams.length / 2);
  const last = race.teams.find((t) => t.positions[week] === eaters);
  const bar = last?.points[week] ?? 0;
  return new Map(race.teams.map((t) => [t.id, Math.max(0, bar - t.points[week])]));
}

export interface Comeback {
  deficit: number;
  name: string;
  season: number;
  // Checkpoint and weeks left when they trailed by that much
  week: number;
  weeksLeft: number;
}

// For each number of weeks left, the deepest hole any eventual eater climbed
// out of with that many weeks left or fewer. A missing entry means no past
// season reaches back that far.
export function tombstoneLine(history: { season: number; race: Race }[]) {
  const deepest: (Comeback | null)[] = [];
  for (const { season, race } of history) {
    const end = race.checkpoints.length - 1;
    for (let week = 0; week <= end; week++) {
      const weeksLeft = end - week;
      const behind = deficits(race, week);
      deepest[weeksLeft] ??= null;
      for (const t of race.teams) {
        if (t.zones[end] !== 'eater') continue;
        const deficit = behind.get(t.id)!;
        if (deficit > (deepest[weeksLeft]?.deficit ?? 0)) {
          deepest[weeksLeft] = { deficit, name: t.name, season, week, weeksLeft };
        }
      }
    }
  }
  // "Or later": a hole climbed out of with fewer weeks left counts too
  const line: (Comeback | null)[] = [];
  let best: Comeback | null = null;
  for (let w = 0; w < deepest.length; w++) {
    if (deepest[w] && deepest[w]!.deficit > (best?.deficit ?? 0)) best = deepest[w];
    line[w] = best;
  }
  return line;
}

// Buried: deeper than the line. With no history reaching back that far
// (an unusually long season) nobody is buried yet.
export function isTombstoned(deficit: number, weeksLeft: number, line: (Comeback | null)[]) {
  if (deficit <= 0 || weeksLeft >= line.length) return false;
  return deficit > (line[weeksLeft]?.deficit ?? 0);
}

export function tombstoned(race: Race, week: number, line: (Comeback | null)[]) {
  const end = race.checkpoints.length - 1;
  const behind = deficits(race, week);
  return new Set(
    race.teams.filter((t) => isTombstoned(behind.get(t.id)!, end - week, line)).map((t) => t.id),
  );
}
