import { useState } from 'react';
import { useElementWidth } from '@/hooks/useElementWidth';
import type { SteakSeason } from '@/utils/steak-season';
import { getSteakLine, getSteakZone } from '@/utils/steak-teams';
import { zoneBand, zoneStroke } from './zone-colors';

interface Props {
  season: SteakSeason;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

// Rank after every week as one line per team, with the steak line splitting
// the eaters from the buyers. Tap a line or name to follow one team.
export default function BumpChart({ season, selected, onSelect }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<string | null>(null);
  const { weeks, teams } = season;
  const teamCount = teams.length;
  const last = weeks.length - 1;

  const compact = width < 480;
  const rowHeight = compact ? 20 : 26;
  const top = 22;
  const left = 24;
  const right = compact ? 78 : 128;
  const height = top + teamCount * rowHeight + 6;
  const plotWidth = Math.max(width - left - right, 0);
  const step = weeks.length > 1 ? plotWidth / last : 0;

  const x = (i: number) =>
    weeks.length > 1 ? left + i * step : left + plotWidth / 2;
  const y = (rank: number) => top + (rank - 0.5) * rowHeight;

  const { eaters, selfBuyer } = getSteakLine(teamCount);
  const focus = hovered ?? selected;

  // Label every week when there is room, otherwise every other one
  const labelEvery = step < 18 ? 2 : 1;

  const pathFor = (ranks: number[]) =>
    ranks
      .map((rank, i) => {
        if (i === 0) return `M${x(0)},${y(rank)}`;
        const midX = (x(i - 1) + x(i)) / 2;
        return `C${midX},${y(ranks[i - 1])} ${midX},${y(rank)} ${x(i)},${y(rank)}`;
      })
      .join(' ');

  const focusTeam = teams.find((team) => team.id === focus);

  return (
    <div ref={ref} className="w-full select-none">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Steak rank of each team after weeks ${weeks[0]} to ${weeks[last]}`}
          className="block overflow-visible"
          onPointerLeave={() => setHovered(null)}
        >
          {/* Zone bands */}
          {Array.from({ length: teamCount }, (_, i) => (
            <rect
              key={i}
              x={left - 20}
              y={top + i * rowHeight}
              width={width - left + 20}
              height={rowHeight}
              fill={zoneBand[getSteakZone(i + 1, teamCount)]}
              opacity={i % 2 ? 0.7 : 1}
            />
          ))}

          {/* Steak line below the last eater */}
          <line
            x1={left - 20}
            x2={width}
            y1={top + eaters * rowHeight}
            y2={top + eaters * rowHeight}
            stroke="#34d399"
            strokeOpacity={0.5}
            strokeDasharray="3 4"
          />
          {!selfBuyer ? null : (
            <line
              x1={left - 20}
              x2={width}
              y1={top + (eaters + 1) * rowHeight}
              y2={top + (eaters + 1) * rowHeight}
              stroke="#f87171"
              strokeOpacity={0.4}
              strokeDasharray="3 4"
            />
          )}

          {/* Rank axis */}
          {teams.map((_, i) => (
            <text
              key={i}
              x={left - 12}
              y={y(i + 1)}
              dy="0.35em"
              textAnchor="middle"
              className="fill-gray-500 font-mono"
              fontSize={compact ? 9 : 11}
            >
              {i + 1}
            </text>
          ))}

          {/* Week axis */}
          {weeks.map((week, i) =>
            i % labelEvery === 0 || i === last ? (
              <text
                key={week}
                x={x(i)}
                y={top - 8}
                textAnchor="middle"
                className="fill-gray-500 font-mono"
                fontSize={compact ? 9 : 11}
              >
                {i === 0 ? `W${week}` : week}
              </text>
            ) : null,
          )}

          {/* One line per team, drawn in on load */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {teams.map((team, index) => {
              const finalRank = team.ranks[last];
              const zone = getSteakZone(finalRank, teamCount);
              const d = pathFor(team.ranks);
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
                    strokeWidth={Math.max(rowHeight * 0.6, 10)}
                    className="cursor-pointer"
                    onPointerEnter={(event) =>
                      event.pointerType === 'mouse' && setHovered(team.id)
                    }
                    onClick={() =>
                      onSelect(selected === team.id ? null : team.id)
                    }
                  />
                </g>
              );
            })}

            {/* The followed team, traced on top of the rest. Keyed so the
                trace replays only when a different team is picked. */}
            {focusTeam && (
              <path
                key={focusTeam.id}
                d={pathFor(focusTeam.ranks)}
                pathLength={1}
                stroke="#fde68a"
                strokeWidth={3.5}
                className="steak-draw pointer-events-none"
                style={{ animationDuration: '500ms' }}
              />
            )}
          </g>

          {/* Weekly rank markers for the focused team */}
          {focus &&
            teams
              .filter((team) => team.id === focus)
              .map((team) =>
                team.ranks.map((rank, i) => (
                  <g key={i} className="pointer-events-none">
                    <circle
                      cx={x(i)}
                      cy={y(rank)}
                      r={compact ? 7 : 9}
                      fill="#0a0a0a"
                      stroke="#fde68a"
                      strokeWidth={1.5}
                    />
                    <text
                      x={x(i)}
                      y={y(rank)}
                      dy="0.35em"
                      textAnchor="middle"
                      className="fill-amber-100 font-mono font-semibold"
                      fontSize={compact ? 8 : 10}
                    >
                      {rank}
                    </text>
                  </g>
                )),
              )}

          {/* Names at each team's latest rank */}
          {teams.map((team) => {
            const rank = team.ranks[last];
            const zone = getSteakZone(rank, teamCount);
            const isFocus = team.id === focus;
            return (
              <text
                key={team.id}
                x={x(last) + (compact ? 10 : 14)}
                y={y(rank)}
                dy="0.35em"
                fontSize={compact ? 10 : 12}
                fill={isFocus ? '#fef3c7' : zoneStroke[zone]}
                fillOpacity={focus && !isFocus ? 0.35 : 0.9}
                fontWeight={isFocus ? 700 : 500}
                className="cursor-pointer transition-[fill-opacity] duration-200"
                onPointerEnter={(event) =>
                  event.pointerType === 'mouse' && setHovered(team.id)
                }
                onClick={() => onSelect(selected === team.id ? null : team.id)}
              >
                {compact ? team.shortName : team.name}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
