import { useState } from 'react';
import clsx from 'clsx';
import { CATEGORIES } from '../lib/roto';
import type { StandingRow } from '../lib/standings';
import { formatPoints } from '../lib/format';

// Every team's total and roto points in each category. Tap a category to
// sort by it; the team column stays put while the categories scroll.
export default function CategoryTable({ rows }: { rows: StandingRow[] }) {
  const [sortBy, setSortBy] = useState<number | null>(null);
  const sorted =
    sortBy === null
      ? rows
      : [...rows].sort(
          (a, b) =>
            b.categories[sortBy].points - a.categories[sortBy].points ||
            a.position - b.position,
        );
  const teamCount = rows.length;

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
            {CATEGORIES.map((category, i) => (
              <th
                key={category.key}
                className="cat num"
                scope="col"
                aria-sort={sortBy === i ? 'descending' : undefined}
                onClick={() => setSortBy(sortBy === i ? null : i)}
              >
                {category.label}
              </th>
            ))}
            <th className="num" scope="col" style={{ paddingRight: 12 }}>
              Roto points
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.team.id}>
              <td className="sticky team-cell">
                <span className="who">{row.name}</span>
              </td>
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
