// Roto scoring for the NBA Steak League. Self-contained (no imports) so
// scripts/nba/build-seasons.mjs can load it straight into Node.
//
// A stat line is ESPN's stats in this order (see worker/nba/config.js):
// PTS, REB, AST, 3PM, STL, BLK, FGM, FGA, FTM, FTA
export type StatLine = number[];

export interface Category {
  key: string;
  label: string;
  value: (line: StatLine) => number;
  format: (value: number) => string;
}

const count = (index: number) => (line: StatLine) => line[index] ?? 0;
const ratio = (made: number, tried: number) => (line: StatLine) =>
  line[tried] ? line[made] / line[tried] : 0;
const whole = (value: number) => Math.round(value).toLocaleString('en-US');
const percent = (value: number) => value.toFixed(3).replace(/^0/, '');

export const CATEGORIES: Category[] = [
  { key: 'pts', label: 'PTS', value: count(0), format: whole },
  { key: 'reb', label: 'REB', value: count(1), format: whole },
  { key: 'ast', label: 'AST', value: count(2), format: whole },
  { key: 'tpm', label: '3PM', value: count(3), format: whole },
  { key: 'stl', label: 'STL', value: count(4), format: whole },
  { key: 'blk', label: 'BLK', value: count(5), format: whole },
  { key: 'fgp', label: 'FG%', value: ratio(6, 7), format: percent },
  { key: 'ftp', label: 'FT%', value: ratio(8, 9), format: percent },
];

export const emptyLine = (): StatLine => Array(10).fill(0);

export function addLine(into: StatLine, line: StatLine) {
  for (let i = 0; i < 10; i++) into[i] += line[i] ?? 0;
  return into;
}

export interface CategoryResult {
  value: number;
  // Roto points: 1 for last up to one per team for first; ties split them
  points: number;
}

export interface RotoTeam {
  id: number;
  points: number;
  categories: CategoryResult[];
}

const EPSILON = 1e-9;

// Roto points for every team, best first (ties keep the input order)
export function scoreRoto(totals: Map<number, StatLine>): RotoTeam[] {
  const ids = [...totals.keys()];
  const teams = new Map<number, RotoTeam>(
    ids.map((id) => [id, { id, points: 0, categories: [] }]),
  );
  for (const category of CATEGORIES) {
    const values = ids.map((id) => category.value(totals.get(id)!));
    ids.forEach((id, i) => {
      const value = values[i];
      let below = 0;
      let tied = 0;
      for (const other of values) {
        if (other < value - EPSILON) below++;
        else if (Math.abs(other - value) <= EPSILON) tied++;
      }
      const points = below + (tied + 1) / 2;
      const team = teams.get(id)!;
      team.categories.push({ value, points });
      team.points += points;
    });
  }
  return [...teams.values()].sort((a, b) => b.points - a.points);
}
