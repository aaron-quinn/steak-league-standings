import clsx from 'clsx';
import { formatPoints } from '../lib/format';
import { lastName } from '../lib/standings';
import { seasonLabel } from '../lib/season';
import type { Pit } from '../lib/useSteakOdds';

// Every team behind the steak line, by how deep a hole it's in. The dashed
// line is the deepest comeback any eater has made from this point of a
// season; past it, and under 5% to eat, a team is tombstoned.
export default function TombstonePit({ pit }: { pit: Pit }) {
  const { chasers, record, weeksLeft } = pit;
  const deepest = Math.max(record?.deficit ?? 0, ...chasers.map((c) => c.deficit), 1);
  const scale = (d: number) => `${Math.min(100, (d / deepest) * 100)}%`;
  const buried = chasers.filter((c) => c.buried);

  return (
    <section className="nba-panel" aria-label="Tombstone pit">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">The pit 🪦</h3>
        <span className="nba-dim" style={{ fontSize: 12.5 }}>
          {weeksLeft} {weeksLeft === 1 ? 'week' : 'weeks'} left
        </span>
      </div>
      {chasers.length === 0 ? (
        <p className="nba-empty" style={{ padding: 16 }}>
          Nobody&rsquo;s behind the steak line.
        </p>
      ) : (
        <ul className="nba-pit">
          {record && record.deficit > 0 && (
            <li
              className="nba-pit-line"
              style={{ '--at-ratio': Math.min(1, record.deficit / deepest) } as React.CSSProperties}
              aria-hidden="true"
            />
          )}
          {chasers.map((c) => (
            <li key={c.id} className={clsx('nba-pit-row', { buried: c.buried })}>
              <span className="name">
                {c.buried && '🪦 '}
                {lastName(c.name)}
              </span>
              <span className="depth">
                <span style={{ width: scale(c.deficit) }} />
              </span>
              <span className="value">−{formatPoints(c.deficit)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="nba-foot" style={{ margin: '0 12px 12px' }}>
        {record && record.deficit > 0 ? (
          <>
            Points behind the last steak spot. The dashed line is{' '}
            <b>{formatPoints(record.deficit)} back</b>: no team deeper than that with{' '}
            {weeksLeft} weeks left, or later, has come back to eat.{' '}
            {lastName(record.name)} climbed out of that hole in{' '}
            {seasonLabel(record.season)}.
          </>
        ) : record ? (
          <>No team behind the steak line this late has ever come back to eat.</>
        ) : (
          <>The line appears once past seasons reach back this far.</>
        )}{' '}
        Below the line and under 5% to eat means tombstoned
        {buried.length > 0 ? `: ${buried.map((b) => lastName(b.name)).join(', ')}.` : '; nobody is yet.'}
      </p>
    </section>
  );
}
