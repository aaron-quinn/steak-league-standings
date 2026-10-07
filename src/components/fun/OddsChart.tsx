import { useState } from 'react';
import { useElementWidth } from '@/hooks/useElementWidth';
import { formatChance } from '@/utils/format-score';
import type { SteakSeason } from '@/utils/steak-season';
import { getSteakLine, getSteakZone } from '@/utils/steak-teams';
import { zoneStroke } from './zone-colors';

interface Props {
  season: SteakSeason;
  // Each team's chance of eating before a snap, then after every week
  chances: Map<string, number[]>;
  // The season is over, so the last chances are certainties
  settled: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

const GRID = [0, 0.25, 0.75, 1];

// Spreads labels out so none overlap, keeping each as close to its line's
// end as it can, within the given bounds
function spreadLabels(
  wanted: { id: string; y: number }[],
  gap: number,
  min: number,
  max: number,
) {
  const sorted = [...wanted].sort((a, b) => a.y - b.y);
  const placed = sorted.map(({ y }) => y);
  for (let i = 0; i < placed.length; i++) {
    placed[i] = Math.max(placed[i], i === 0 ? min : placed[i - 1] + gap);
  }
  for (let i = placed.length - 1; i >= 0; i--) {
    placed[i] = Math.min(
      placed[i],
      i === placed.length - 1 ? max : placed[i + 1] - gap,
    );
  }
  return new Map(sorted.map(({ id }, i) => [id, placed[i]]));
}

// Each team's chance of eating steak after every week as one line per team,
// starting from preseason when everyone has the same shot. Tap a line or
// name to follow one team.
export default function OddsChart({
  season,
  chances,
  settled,
  selected,
  onSelect,
}: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<string | null>(null);
  const { weeks, teams } = season;
  const teamCount = teams.length;
  // Points run from preseason (0) to the latest week
  const last = weeks.length;

  const compact = width < 480;
  const top = 22;
  const bottom = 10;
  const left = 34;
  const right = compact ? 104 : 164;
  const plotHeight = compact ? 300 : 420;
  const height = top + plotHeight + bottom;
  const plotWidth = Math.max(width - left - right, 0);
  const step = plotWidth / last;

  const x = (i: number) => left + i * step;
  const y = (chance: number) => top + (1 - chance) * plotHeight;

  const fairShare = getSteakLine(teamCount).eaters / teamCount;
  const focus = hovered ?? selected;
  const labelEvery = step < 18 ? 2 : 1;

  const pathFor = (values: number[]) =>
    values
      .map((value, i) => {
        if (i === 0) return `M${x(0)},${y(value)}`;
        const midX = (x(i - 1) + x(i)) / 2;
        return `C${midX},${y(values[i - 1])} ${midX},${y(value)} ${x(i)},${y(value)}`;
      })
      .join(' ');

  const series = (id: string) => chances.get(id) ?? [];
  const latest = (id: string) => series(id)[last] ?? 0;
  const focusTeam = teams.find((team) => team.id === focus);

  const fontSize = compact ? 10 : 12;
  const labelY = spreadLabels(
    teams.map((team) => ({ id: team.id, y: y(latest(team.id)) })),
    fontSize + 1,
    top - 6,
    top + plotHeight + bottom - 4,
  );
  const labelX = x(last) + (compact ? 14 : 20);

  const handlers = (id: string) => ({
    onPointerEnter: (event: React.PointerEvent) =>
      event.pointerType === 'mouse' && setHovered(id),
    onClick: () => onSelect(selected === id ? null : id),
  });

  return (
    <div ref={ref} className="w-full select-none">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Each team's chance of eating steak after weeks ${weeks[0]} to ${weeks[last - 1]}`}
          className="block overflow-visible"
          onPointerLeave={() => setHovered(null)}
        >
          {/* Chance axis, with everyone's preseason shot marked like the
              steak line. It's the share of teams that eat, so just under
              half when an odd team out buys its own. */}
          {[...GRID, fairShare].map((chance) => (
            <g key={chance}>
              <line
                x1={left}
                x2={x(last)}
                y1={y(chance)}
                y2={y(chance)}
                stroke={chance === fairShare ? '#34d399' : '#262626'}
                strokeOpacity={chance === fairShare ? 0.5 : 1}
                strokeDasharray={chance === fairShare ? '3 4' : undefined}
              />
              <text
                x={left - 8}
                y={y(chance)}
                dy="0.35em"
                textAnchor="end"
                className={
                  chance === fairShare
                    ? 'fill-emerald-400/70 font-mono'
                    : 'fill-gray-500 font-mono'
                }
                fontSize={compact ? 9 : 11}
              >
                {`${Math.round(chance * 100)}%`}
              </text>
            </g>
          ))}

          {/* Week axis */}
          {Array.from({ length: last + 1 }, (_, i) =>
            i === 0 || i % labelEvery === 0 || i === last ? (
              <text
                key={i}
                x={x(i)}
                y={top - 8}
                textAnchor="middle"
                className="fill-gray-500 font-mono"
                fontSize={compact ? 9 : 11}
              >
                {i === 0 ? 'Pre' : i === 1 ? `W${weeks[0]}` : weeks[i - 1]}
              </text>
            ) : null,
          )}

          {/* One line per team, drawn in on load */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {teams.map((team, index) => {
              const zone = getSteakZone(team.ranks[last - 1], teamCount);
              const d = pathFor(series(team.id));
              return (
                <g key={team.id}>
                  <path
                    d={d}
                    pathLength={1}
                    stroke={zoneStroke[zone]}
                    strokeWidth={compact ? 1.5 : 2}
                    strokeOpacity={focus !== null ? 0.12 : 0.55}
                    className="steak-draw transition-[stroke-opacity] duration-200"
                    style={{ animationDelay: `${index * 25}ms` }}
                  />
                  {/* Wide invisible stroke so thin lines are easy to tap */}
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth={10}
                    className="cursor-pointer"
                    {...handlers(team.id)}
                  />
                </g>
              );
            })}

            {/* The followed team, traced on top of the rest. Keyed so the
                trace replays only when a different team is picked. */}
            {focusTeam && (
              <path
                key={focusTeam.id}
                d={pathFor(series(focusTeam.id))}
                pathLength={1}
                stroke="#fde68a"
                strokeWidth={3.5}
                className="steak-draw pointer-events-none"
                style={{ animationDuration: '500ms' }}
              />
            )}
          </g>

          {/* Weekly markers for the focused team */}
          {focusTeam &&
            series(focusTeam.id).map((chance, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(chance)}
                r={compact ? 2.5 : 3.5}
                fill="#0a0a0a"
                stroke="#fde68a"
                strokeWidth={1.5}
                className="pointer-events-none"
              />
            ))}

          {/* Names beside each team's latest chance, nudged apart where
              lines finish close together and tied back to their line */}
          {teams.map((team) => {
            const zone = getSteakZone(team.ranks[last - 1], teamCount);
            const isFocus = team.id === focus;
            const chance = latest(team.id);
            const placed = labelY.get(team.id) ?? y(chance);
            return (
              <g key={team.id}>
                <line
                  x1={x(last) + 3}
                  x2={labelX - 3}
                  y1={y(chance)}
                  y2={placed}
                  stroke={isFocus ? '#fde68a' : zoneStroke[zone]}
                  strokeOpacity={focus && !isFocus ? 0.12 : 0.35}
                  className="pointer-events-none"
                />
                <text
                  x={labelX}
                  y={placed}
                  dy="0.35em"
                  fontSize={fontSize}
                  fill={isFocus ? '#fef3c7' : zoneStroke[zone]}
                  fillOpacity={focus && !isFocus ? 0.35 : 0.9}
                  fontWeight={isFocus ? 700 : 500}
                  className="cursor-pointer transition-[fill-opacity] duration-200"
                  {...handlers(team.id)}
                >
                  <tspan className="font-mono tabular-nums">
                    {formatChance(chance, settled).padStart(4, ' ')}
                  </tspan>{' '}
                  {compact ? team.shortName : team.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
