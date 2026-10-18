import { useState } from 'react';
import clsx from 'clsx';
import { useElementWidth } from '@/hooks/useElementWidth';
import { monthTicks } from '../lib/chart';
import type { OddsHistory } from '../lib/season-odds';
import { shortDate } from '../lib/season';

interface Props {
  history: OddsHistory;
  followed: number | null;
  onFollow: (id: number | null) => void;
  // The week a replay is showing; tapping the chart away from a line picks one
  marker?: number;
  onPickWeek?: (week: number) => void;
}

const MARGIN = { top: 12, right: 78, bottom: 26, left: 34 };
const HEIGHT = 260;
const pct = (p: number) => `${Math.round(p * 100)}%`;

// Each team's chance of eating at the end of every lineup week. Lines are
// gray; the followed team is the one bright line, and every line ends in its
// name, so nothing depends on telling hues apart.
export default function OddsChart({ history, followed, onFollow, marker, onPickWeek }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { race, eat } = history;
  const weeks = race.checkpoints.length;
  const end = weeks - 1;
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (i: number) => MARGIN.left + (end > 0 ? (i / end) * plotWidth : plotWidth);
  const y = (p: number) => MARGIN.top + (1 - p) * plotHeight;

  // End labels: only the followed team and anyone still between 5% and 95%
  // at the end, nudged apart so they don't overlap
  const labelled = race.teams
    .filter((t) => {
      const last = eat.get(t.id)![end];
      return t.id === followed || (last > 0.05 && last < 0.95);
    })
    .map((t) => ({ t, at: y(eat.get(t.id)![end]) }))
    .sort((a, b) => a.at - b.at);
  for (let i = 1; i < labelled.length; i++) {
    labelled[i].at = Math.max(labelled[i].at, labelled[i - 1].at + 13);
  }

  const lead = followed !== null ? race.teams.find((t) => t.id === followed) : undefined;
  const ordered = [...race.teams].sort((a, b) => Number(a.id === followed) - Number(b.id === followed));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && weeks > 0 && (
        <svg
          className="nba-chart"
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Each team's chance of eating steak, week by week"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.max(0, Math.min(end, Math.round(((e.clientX - r.left - MARGIN.left) / plotWidth) * end))));
          }}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            if (!onPickWeek) return;
            const r = e.currentTarget.getBoundingClientRect();
            onPickWeek(Math.max(0, Math.min(end, Math.round(((e.clientX - r.left - MARGIN.left) / plotWidth) * end))));
          }}
          style={onPickWeek ? { cursor: 'crosshair' } : undefined}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line className={p === 0.5 ? 'steak-rule' : 'grid'} x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(p)} y2={y(p)} />
              <text className="axis" x={MARGIN.left - 6} y={y(p) + 4} textAnchor="end">
                {pct(p)}
              </text>
            </g>
          ))}
          {monthTicks(race.checkpoints.map((c) => c.date), x).map((t) => (
            <text key={t.i} className="axis" x={x(t.i)} y={HEIGHT - 6} textAnchor="middle">
              {t.label}
            </text>
          ))}
          {marker !== undefined && (
            <g>
              <line
                x1={x(marker)}
                x2={x(marker)}
                y1={MARGIN.top - 6}
                y2={MARGIN.top + plotHeight}
                stroke="#3ee6ff"
                strokeWidth={1.5}
                style={{ filter: 'drop-shadow(0 0 4px rgb(62 230 255 / 0.8))' }}
              />
              <circle cx={x(marker)} cy={MARGIN.top - 6} r={3.5} fill="#3ee6ff" />
            </g>
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="rgb(230 236 255 / 0.35)" />
          )}
          {ordered.map((t) => {
            const on = t.id === followed;
            const d = eat.get(t.id)!.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join('');
            return (
              <g
                key={t.id}
                onClick={(e) => {
                  // Following a team shouldn't also move the replay
                  e.stopPropagation();
                  onFollow(on ? null : t.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                <path
                  className={clsx('line', { on, dim: followed !== null && !on })}
                  d={d}
                  stroke={on ? '#e6ecff' : '#7d87b8'}
                  style={on ? { filter: 'drop-shadow(0 0 6px rgb(62 230 255 / 0.8))' } : undefined}
                />
              </g>
            );
          })}
          {labelled.map(({ t, at }) => (
            <text
              key={t.id}
              className="end"
              x={x(end) + 8}
              y={at + 4}
              fill={t.id === followed ? '#e6ecff' : '#8792bd'}
              onClick={() => onFollow(t.id === followed ? null : t.id)}
              style={{ cursor: 'pointer' }}
            >
              {t.short} {pct(eat.get(t.id)![end])}
            </text>
          ))}
        </svg>
      )}
      {hover !== null && (
        <div className="nba-tooltip" style={{ left: Math.min(Math.max(x(hover), 90), width - 90), top: 0 }}>
          <b>Week of {shortDate(race.checkpoints[hover].date)}</b>
          {(lead
            ? [lead]
            : [...race.teams]
                .filter((t) => {
                  const p = eat.get(t.id)![hover];
                  return p > 0.05 && p < 0.95;
                })
                .sort((a, b) => eat.get(b.id)![hover] - eat.get(a.id)![hover])
                .slice(0, 6)
          ).map((t) => (
            <span key={t.id}>
              {t.short}
              <em>{pct(eat.get(t.id)![hover])}</em>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
