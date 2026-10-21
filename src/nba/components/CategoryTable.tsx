import { useState } from 'react';
import clsx from 'clsx';
import { CATEGORIES } from '../lib/roto';
import type { PlayingTime, StandingRow } from '../lib/standings';
import { formatPoints } from '../lib/format';

interface Props {
  rows: StandingRow[];
  // Games and minutes each team's active lineup played: null while loading,
  // left out for a season without player lines
  games?: Map<number, PlayingTime> | null;
}

type Time = keyof PlayingTime;
type Sort = number | Time | null;

const TIME: { key: Time; label: string; title: string }[] = [
  { key: 'games', label: 'GP', title: "Games played by the active lineup (bench and IR don't count)" },
  { key: 'minutes', label: 'MIN', title: "Minutes played by the active lineup (bench and IR don't count)" },
];

// Every team's total and roto points in each category. Tap a category to
// sort by it; the team column stays put while the categories scroll.
export default function CategoryTable({ rows, games }: Props) {
  const [sortBy, setSortBy] = useState<Sort>(null);
  const time = (row: StandingRow, key: Time) => games?.get(row.team.id)?.[key] ?? 0;
  const sorted =
    sortBy === null
      ? rows
      : [...rows].sort(
          (a, b) =>
            (typeof sortBy === 'string'
              ? time(b, sortBy) - time(a, sortBy)
              : b.categories[sortBy].points - a.categories[sortBy].points) ||
            a.position - b.position,
        );
  const teamCount = rows.length;
  const average = (key: Time) =>
    rows.reduce((sum, row) => sum + time(row, key), 0) / (rows.length || 1);
  const toggle = (key: Sort) => setSortBy(sortBy === key ? null : key);

  return (
    <div className="nba-scroll">
      <table className="nba-table nba-cats">
        <thead>
          <tr>
            <th
              className="sticky team-cell"
              scope="col"
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setSortBy(null)}
            >
              Team
            </th>
            {games !== undefined &&
              TIME.map(({ key, label, title }) => (
                <th
                  key={key}
                  className={clsx('cat num time', key)}
                  scope="col"
                  title={title}
                  aria-sort={sortBy === key ? 'descending' : undefined}
                  onClick={() => toggle(key)}
                >
                  {label}
                </th>
              ))}
            {CATEGORIES.map((category, i) => (
              <th
                key={category.key}
                className="cat num"
                scope="col"
                aria-sort={sortBy === i ? 'descending' : undefined}
                onClick={() => toggle(i)}
              >
                {category.label}
              </th>
            ))}
            <th className="num" scope="col" style={{ paddingRight: 12 }} title="Roto points">
              Roto
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.team.id}>
              <td className="sticky team-cell">
                <span className="who">{row.name}</span>
              </td>
              {games !== undefined &&
                TIME.map(({ key }) => (
                  <td key={key} className={clsx('cat time', key)}>
                    {games ? (
                      <>
                        <b>{time(row, key).toLocaleString('en-US')}</b>
                        <span>{versus(time(row, key) - average(key))}</span>
                      </>
                    ) : (
                      <b className="nba-faint">–</b>
                    )}
                  </td>
                ))}
              {CATEGORIES.map((category, i) => {
                const { value, points } = row.categories[i];
                return (
                  <td
                    key={category.key}
                    className={clsx('cat', {
                      top: points >= teamCount - 0.5,
                      bottom: points <= 1.5,
                    })}
                  >
                    <b>{category.format(value)}</b>
                    <span>{formatPoints(points)}</span>
                  </td>
                );
              })}
              <td className="num total">{formatPoints(row.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Above or below the league average: "+12", "−8", "avg"
function versus(diff: number) {
  const n = Math.round(diff);
  if (n === 0) return 'avg';
  const abs = Math.abs(n).toLocaleString('en-US');
  return n > 0 ? `+${abs}` : `−${abs}`;
}
