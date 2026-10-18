import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { formatPoints, ordinal } from '../lib/format';
import { slugify } from '../lib/people';
import type { StandingRow } from '../lib/standings';

interface Props {
  rows: StandingRow[];
  // Show what ESPN's own final standings said, for seasons that ended early
  showESPN?: boolean;
  // Teams tombstoned right now (live season)
  buried?: Set<number>;
}

export default function StandingsTable({ rows, showESPN = false, buried }: Props) {
  const eaters = rows.filter((r) => r.zone === 'eater').length;
  const lineAfter = rows.some((r) => r.zone === 'self-buyer')
    ? eaters + 1
    : eaters;
  return (
    <table className="nba-table">
      <caption className="sr-only">
        Roto standings. The top {eaters} eat steak
        {lineAfter > eaters && `; ${ordinal(eaters + 1)} buys their own`}.
      </caption>
      <thead>
        <tr>
          <th className="rank" scope="col">
            #
          </th>
          <th scope="col" style={{ textAlign: 'left' }}>
            Team
          </th>
          <th className="num" scope="col" style={{ paddingRight: 12 }}>
            Roto points
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const tied = rows.some((o) => o !== row && o.rank === row.rank);
          const differs = showESPN && row.team.espn.rank !== row.rank;
          return (
            <tr
              key={row.team.id}
              className={clsx(row.zone, {
                leader: row.position === 1,
                'steak-line': row.position === lineAfter,
              })}
            >
              <td className="rank">
                {tied ? 'T' : ''}
                {row.rank}
              </td>
              <td className="team-cell">
                {row.team.owner ? (
                  <Link to={`/nba/managers/${slugify(row.name)}`} className="who">
                    {row.name}
                    {buried?.has(row.team.id) && <span title="Tombstoned"> 🪦</span>}
                    {row.zone === 'self-buyer' && (
                      <span className="nba-zone-tag">Buys own</span>
                    )}
                  </Link>
                ) : (
                  <span className="who">{row.name}</span>
                )}
                <span className="team-name">
                  {row.team.owner ? row.team.name : 'No owner yet'}
                  {differs && (
                    <span className="espn">
                      {' '}
                      · ESPN had {ordinal(row.team.espn.rank)}
                    </span>
                  )}
                </span>
              </td>
              <td className="num pts">{formatPoints(row.points)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
