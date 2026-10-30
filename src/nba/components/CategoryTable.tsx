import StandingsName from './StandingsName';
import { useMemo, useState, type CSSProperties } from 'react';
import clsx from 'clsx';
import { findComps, type Comp, type PlayerPool } from '../lib/comps';
import { CATEGORIES, scoreRoto, type CategoryResult } from '../lib/roto';
import type { PlayingTime, StandingRow } from '../lib/standings';
import { formatPoints } from '../lib/format';
import { seasonLabel } from '../lib/season';

interface Props {
  rows: StandingRow[];
  // Games and minutes each team's active lineup played: null while loading,
  // left out for a season without player lines
  games?: Map<number, PlayingTime> | null;
  // NBA players to find per-game comps in: null while loading
  pool?: PlayerPool | null;
}

type Time = keyof PlayingTime;
type Sort = number | Time | null;
type Mode = 'totals' | 'perGame' | 'points';

// Per game played by the active lineup, so a player-game. Percentages are
// already rates.
const RATES = new Set(['fgp', 'ftp']);
const perGameFormat = (index: number, value: number) =>
  RATES.has(CATEGORIES[index].key) ? CATEGORIES[index].format(value) : value.toFixed(1);

const compLine = (comp: Comp) =>
  CATEGORIES.map((c, i) => `${perGameFormat(i, comp.values[i])} ${c.label}`).join(' · ');

const TIME: { key: Time; label: string; title: string }[] = [
  { key: 'games', label: 'GP', title: "Games played by the active lineup (bench and IR don't count)" },
  { key: 'minutes', label: 'MIN', title: "Minutes played by the active lineup (bench and IR don't count)" },
];

// Every team's total and roto points in each category. Tap a category to
// sort by it; the team column stays put while the categories scroll.
export default function CategoryTable({ rows, games, pool }: Props) {
  const [sortBy, setSortBy] = useState<Sort>(null);
  const [chosenMode, setMode] = useState<Mode>('totals');
  // Per game needs games played, which load separately
  const mode = chosenMode === 'perGame' && !games ? 'totals' : chosenMode;
  const time = (row: StandingRow, key: Time) => games?.get(row.team.id)?.[key] ?? 0;
  // Each team's line divided by its games played, ranked like the real table
  // so the tints and sorting follow per-game standing. Percentages don't move.
  const perGame = useMemo(() => {
    if (!games) return undefined;
    const lines = new Map(
      rows.map((row) => {
        const gp = games.get(row.team.id)?.games ?? 0;
        return [row.team.id, row.team.totals.map((v) => (gp ? v / gp : 0))];
      }),
    );
    return new Map(scoreRoto(lines).map((r) => [r.id, r.categories]));
  }, [rows, games]);
  const comps = useMemo(() => {
    if (!perGame || !pool) return undefined;
    return findComps(
      pool,
      new Map([...perGame].map(([id, categories]) => [id, categories.map((c) => c.value)])),
    );
  }, [perGame, pool]);
  const showComps = mode === 'perGame' && pool !== undefined;
  const cats = (row: StandingRow): CategoryResult[] =>
    (mode === 'perGame' && perGame?.get(row.team.id)) || row.categories;
  const sorted =
    sortBy === null
      ? rows
      : [...rows].sort(
          (a, b) =>
            (typeof sortBy === 'string'
              ? time(b, sortBy) - time(a, sortBy)
              : cats(b)[sortBy].points - cats(a)[sortBy].points) ||
            a.position - b.position,
        );
  const teamCount = rows.length;
  const toggle = (key: Sort) => setSortBy(sortBy === key ? null : key);
  // The average team's value: percentages are averaged as shown, not pooled
  const average = (of: (row: StandingRow) => number) =>
    rows.reduce((sum, row) => sum + of(row), 0) / teamCount;
  // The third-best value, whichever team has it: the line to clear for the
  // top 3
  const third = (of: (row: StandingRow) => number) =>
    rows.map(of).sort((a, b) => b - a)[Math.min(2, teamCount - 1)];
  const footRows = [
    { label: 'Average', title: 'The average team', of: average },
    { label: 'Top 3', title: "The third-best team's value in each column", of: third },
  ];

  return (
    <>
      <div className="nba-cats-key">
        <div className="nba-seg" role="group" aria-label="Category values">
          <button type="button" aria-pressed={mode === 'totals'} onClick={() => setMode('totals')}>Totals</button>
          <button type="button" aria-pressed={mode === 'points'} onClick={() => setMode('points')}>Roto points</button>
          {games !== undefined && (
            <button
              type="button"
              aria-pressed={mode === 'perGame'}
              disabled={!games}
              title="Each category divided by games played by the active lineup"
              onClick={() => setMode('perGame')}
            >
              Per game
            </button>
          )}
        </div>
        <span className="nba-cats-scale"><span>Bottom 3</span><i aria-hidden="true" /><span>Top 3</span></span>
      </div>
      <div className="nba-scroll">
      <table
        className="nba-table nba-cats"
        aria-label={
          mode === 'points' ? 'Category roto points' : mode === 'perGame' ? 'Category averages per game' : 'Category totals'
        }
      >
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
            {showComps && (
              <th
                className="comp"
                scope="col"
                title={
                  pool
                    ? `The NBA player whose ${seasonLabel(pool.season)} per-game stats have the closest shape: strong and weak in the same categories, measured against other players as the team is against other teams`
                    : undefined
                }
              >
                Player comp
                {pool && <span>{seasonLabel(pool.season)}</span>}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.team.id}>
              <td className="sticky team-cell">
                <span className="who"><StandingsName name={row.name} hasOwner={Boolean(row.team.owner)} /></span>
              </td>
              {games !== undefined &&
                TIME.map(({ key }) => (
                  <td key={key} className={clsx('cat time', key)}>
                    {games ? (
                      <b>{time(row, key).toLocaleString('en-US')}</b>
                    ) : (
                      <b className="nba-faint">–</b>
                    )}
                  </td>
                ))}
              {CATEGORIES.map((category, i) => {
                const { value, points } = cats(row)[i];
                return (
                  <td
                    key={category.key}
                    className="cat"
                    style={{ '--heat': heat(points, teamCount) } as CSSProperties}
                  >
                    <b>
                      {mode === 'points'
                        ? formatPoints(points)
                        : mode === 'perGame'
                          ? perGameFormat(i, value)
                          : category.format(value)}
                    </b>
                  </td>
                );
              })}
              <td className="num total">{formatPoints(row.points)}</td>
              {showComps && <CompCell comp={comps?.get(row.team.id)} loading={!pool} />}
            </tr>
          ))}
        </tbody>
        {mode !== 'points' && teamCount > 0 && (
          <tfoot>
            {footRows.map((foot) => (
              <tr key={foot.label}>
                <th className="sticky team-cell" scope="row" title={foot.title}>
                  {foot.label}
                </th>
                {games !== undefined &&
                  TIME.map(({ key }) => (
                    <td key={key} className={clsx('cat time', key)}>
                      <b>{games ? Math.round(foot.of((row) => time(row, key))).toLocaleString('en-US') : '–'}</b>
                    </td>
                  ))}
                {CATEGORIES.map((category, i) => {
                  const value = foot.of((row) => cats(row)[i].value);
                  return (
                    <td key={category.key} className="cat">
                      <b>{mode === 'perGame' ? perGameFormat(i, value) : category.format(value)}</b>
                    </td>
                  );
                })}
                <td className="num total" />
                {showComps && <td className="comp" />}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
      </div>
    </>
  );
}

function CompCell({ comp, loading }: { comp: Comp | undefined; loading: boolean }) {
  return (
    <td className="comp" title={comp ? compLine(comp) : undefined}>
      {comp ? comp.name : <span className="nba-faint">{loading ? '…' : '–'}</span>}
    </td>
  );
}

// Two tint strengths at each end; the middle stays neutral.
function heat(points: number, teams: number) {
  if (teams < 7) return 'transparent';
  if (points >= teams - 1) return 'rgb(46 224 168 / 0.24)';
  if (points >= teams - 2) return 'rgb(46 224 168 / 0.12)';
  if (points <= 2) return 'rgb(255 82 134 / 0.24)';
  if (points <= 3) return 'rgb(255 82 134 / 0.12)';
  return 'transparent';
}
