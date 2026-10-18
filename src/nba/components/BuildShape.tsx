import { useState } from 'react';
import { ordinal } from '../lib/format';
import { AXES } from '../lib/profile';
import { CATEGORIES, type CategoryResult } from '../lib/roto';
import type { SteakZone } from '../lib/standings';

const SIZE = 200;
const C = SIZE / 2;
const R = 64;
// Last place still leaves a sliver of shape
const FLOOR = 0.1;

function point(axis: number, ratio: number) {
  const angle = (axis / AXES.length) * Math.PI * 2 - Math.PI / 2;
  const r = R * (FLOOR + (1 - FLOOR) * ratio);
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
}

const polygon = (ratios: number[]) =>
  ratios.map((s, axis) => point(axis, s).map((v) => v.toFixed(1)).join(',')).join(' ');

interface Props {
  shape: number[];
  zone: SteakZone | 'career';
  label: string;
  // Per category (CATEGORIES order): the rank, and a value to show beside it
  describe: (category: number) => { rank: string; value?: string };
}

// The rank and stat behind one team-season's spoke
export const describeSeason =
  (categories: CategoryResult[], teamCount: number) => (i: number) => {
    const rank = teamCount + 1 - categories[i].points;
    return {
      rank: `${Number.isInteger(rank) ? '' : 'T-'}${ordinal(Math.floor(rank))} of ${teamCount}`,
      value: CATEGORIES[i].format(categories[i].value),
    };
  };

// An octagon: each spoke is a category, further out for a better rank
export default function BuildShape({ shape, zone, label, describe }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const summary = CATEGORIES.map((c, i) => `${c.label} ${describe(i).rank}`).join(', ');
  const tip = hover === null ? null : point(hover, shape[AXES[hover]]);

  return (
    <div className="nba-shape">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${label}: ${summary}`}>
        {[1 / 3, 2 / 3, 1].map((ring) => (
          <polygon key={ring} className="ring" points={polygon(AXES.map(() => ring))} />
        ))}
        <polygon className="mid" points={polygon(AXES.map(() => 0.5))} />
        {AXES.map((_, axis) => {
          const [x, y] = point(axis, 1);
          return <line key={axis} className="spoke" x1={C} y1={C} x2={x} y2={y} />;
        })}
        <polygon className={`fill ${zone}`} points={polygon(AXES.map((i) => shape[i]))} />
        {AXES.map((i, axis) => {
          const [x, y] = point(axis, shape[i]);
          const [lx, ly] = point(axis, 1.32);
          return (
            <g key={i}>
              <text className="cat" x={lx} y={ly} textAnchor="middle" dominantBaseline="central">
                {CATEGORIES[i].label}
              </text>
              <circle className={`dot ${zone}`} cx={x} cy={y} r={hover === axis ? 4.5 : 3} />
              <circle
                className="hit"
                cx={x}
                cy={y}
                r={13}
                onMouseEnter={() => setHover(axis)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === axis ? null : axis)}
              />
            </g>
          );
        })}
      </svg>
      {tip && hover !== null && (
        <div
          className="nba-tooltip"
          style={{ left: `${(tip[0] / SIZE) * 100}%`, top: `${(tip[1] / SIZE) * 100}%` }}
        >
          <b>{CATEGORIES[AXES[hover]].label}</b>
          <span>
            {describe(AXES[hover]).rank}
            {describe(AXES[hover]).value && <em>{describe(AXES[hover]).value}</em>}
          </span>
        </div>
      )}
    </div>
  );
}
