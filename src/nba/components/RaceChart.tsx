import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useElementWidth } from '@/hooks/useElementWidth';
import { monthTicks } from '../lib/chart';
import { formatPoints, ordinal } from '../lib/format';
import type { Race } from '../lib/race';
import { shortDate } from '../lib/season';
import type { SteakZone } from '../lib/standings';

interface Props {
  race: Race;
  followed: number | null;
  onFollow: (id: number | null) => void;
}

// Each line takes the color of where the team finished: cyan eaters, violet
// for the team buying its own, a receding gray for buyers. Zones are also
// marked by the band and the dashed steak line, so color is never alone.
const ZONE_STROKE: Record<SteakZone, string> = {
  eater: '#3ee6ff',
  'self-buyer': '#9b7bff',
  buyer: '#4b5488',
};

const MARGIN = { top: 14, right: 78, bottom: 26, left: 26 };

// Bump chart of every team's steak position at the end of each lineup week
export default function RaceChart({ race, followed, onFollow }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { checkpoints, teams } = race;
  const n = teams.length;
  const weeks = checkpoints.length;
  const rowHeight = width < 480 ? 22 : 26;
  const height = MARGIN.top + MARGIN.bottom + (n - 1) * rowHeight;
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const x = (i: number) =>
    MARGIN.left + (weeks > 1 ? (i / (weeks - 1)) * plotWidth : plotWidth);
  const y = (position: number) => MARGIN.top + (position - 1) * rowHeight;
  const eaters = Math.floor(n / 2);
  const end = weeks - 1;

  // Draw the followed team last so it sits on top
  const ordered = useMemo(
    () =>
      [...teams].sort(
        (a, b) => Number(a.id === followed) - Number(b.id === followed),
      ),
    [teams, followed],
  );

  const ticks = monthTicks(checkpoints.map((c) => c.date), x);

  const pointerToWeek = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - MARGIN.left;
    return Math.max(0, Math.min(end, Math.round((px / plotWidth) * end)));
  };

  const hoverTeam =
    followed !== null ? teams.find((t) => t.id === followed) : undefined;
  const tooltipRows =
    hover === null
      ? []
      : hoverTeam
        ? [hoverTeam]
        : [
            teams.find((t) => t.positions[hover] === 1)!,
            teams.find((t) => t.positions[hover] === eaters)!,
            teams.find((t) => t.positions[hover] === eaters + 1)!,
          ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && weeks > 0 && (
        <svg
          className="nba-chart"
          width={width}
          height={height}
          role="img"
          aria-label={`Steak positions week by week. ${teams
            .slice()
            .sort((a, b) => a.positions[end] - b.positions[end])
            .map((t) => `${t.short} ${ordinal(t.positions[end])}`)
            .join(', ')}.`}
          onPointerMove={(e) =>
            setHover(pointerToWeek(e.clientX, e.currentTarget.getBoundingClientRect()))
          }
          onPointerLeave={() => setHover(null)}
        >
          <rect
            className="steak-band"
            x={MARGIN.left}
            y={y(1) - rowHeight / 2}
            width={plotWidth}
            height={eaters * rowHeight}
          />
          <line
            className="steak-rule"
            x1={MARGIN.left}
            x2={MARGIN.left + plotWidth}
            y1={y(eaters) + rowHeight / 2}
            y2={y(eaters) + rowHeight / 2}
          />
          {ticks.map((t) => (
            <g key={t.i}>
              <line className="grid" x1={x(t.i)} x2={x(t.i)} y1={MARGIN.top - 8} y2={height - MARGIN.bottom + 6} />
              <text className="axis" x={x(t.i)} y={height - 6} textAnchor="middle">
                {t.label}
              </text>
            </g>
          ))}
          {Array.from({ length: n }, (_, i) => (
            <text key={i} className="axis" x={MARGIN.left - 10} y={y(i + 1) + 4} textAnchor="end">
              {i + 1}
            </text>
          ))}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={MARGIN.top - 10}
              y2={height - MARGIN.bottom + 6}
              stroke="rgb(230 236 255 / 0.35)"
            />
          )}
          {ordered.map((team) => {
            const on = team.id === followed;
            const stroke = on ? '#e6ecff' : ZONE_STROKE[team.zones[end]];
            const d = team.positions
              .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p)}`)
              .join('');
            return (
              <g
                key={team.id}
                onClick={() => onFollow(on ? null : team.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Wide invisible stroke: an easy target on a phone */}
                <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                <path
                  className={clsx('line', { on, dim: followed !== null && !on })}
                  d={d}
                  stroke={stroke}
                  style={on ? { filter: 'drop-shadow(0 0 6px rgb(62 230 255 / 0.8))' } : undefined}
                />
                {on &&
                  team.positions.map((p, i) => (
                    <circle key={i} cx={x(i)} cy={y(p)} r={3} fill="#e6ecff" stroke="#0f1637" strokeWidth={2} />
                  ))}
                <text
                  className="end"
                  x={x(end) + 8}
                  y={y(team.positions[end]) + 4}
                  fill={on ? '#e6ecff' : team.zones[end] === 'buyer' ? '#8792bd' : '#e6ecff'}
                  opacity={followed !== null && !on ? 0.45 : 1}
                >
                  {team.short}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && tooltipRows.length > 0 && (
        <div
          className="nba-tooltip"
          style={{
            left: Math.min(Math.max(x(hover), 90), width - 90),
            top: 0,
          }}
        >
          <b>Week of {shortDate(checkpoints[hover].date)} · Roto points</b>
          {tooltipRows.map((t) => (
            <span key={t.id}>
              {ordinal(t.positions[hover])} {t.short}
              <em>{formatPoints(t.points[hover])}</em>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
