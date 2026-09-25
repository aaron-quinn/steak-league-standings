import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useElementWidth } from '@/hooks/useElementWidth';
import type { SteakSeason } from '@/utils/steak-season';
import { getSteakLine, getSteakZone } from '@/utils/steak-teams';
import { zoneBand, zoneRow, zoneStroke } from './zone-colors';
import { splitScore } from '@/utils/format-score';

interface Props {
  season: SteakSeason;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

const WEEKS_PER_SECOND = 0.7;
const INTRO_HOLD_MS = 300;
const SPEEDS = [1, 2, 4];

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Bar chart race of running points totals. Teams trade places as they pass
// each other, and the steak line stays put while they cross it.
export default function RankRace({ season, selected, onSelect }: Props) {
  const { weeks, teams } = season;
  const weekCount = weeks.length;
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const compact = width > 0 && width < 480;

  // 0 is kickoff, k is the end of the kth played week
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [speed, setSpeed] = useState(1);
  const reducedMotion = useRef(prefersReducedMotion());
  const introPending = useRef(true);

  useEffect(() => {
    if (!playing) return;

    // Without motion, step a whole week at a time
    if (reducedMotion.current) {
      const id = window.setInterval(() => {
        setTime((t) => Math.min(Math.floor(t) + 1, weekCount));
      }, 1200 / speed);
      return () => window.clearInterval(id);
    }

    let frame = 0;
    let previous: number | null = null;
    let introStarted: number | null = null;
    const tick = (now: number) => {
      if (introPending.current) {
        introStarted ??= now;
        if (now - introStarted < INTRO_HOLD_MS) {
          previous = now;
          frame = requestAnimationFrame(tick);
          return;
        }
        introPending.current = false;
      }
      const elapsed = previous === null ? 0 : (now - previous) / 1000;
      previous = now;
      setTime((t) =>
        Math.min(
          t + Math.min(elapsed, 0.05) * WEEKS_PER_SECOND * speed,
          weekCount,
        ),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, weekCount]);

  useEffect(() => {
    if (time >= weekCount) setPlaying(false);
  }, [time, weekCount]);

  const whole = Math.floor(time);
  const fraction = time - whole;
  // Each week the bars grow first, then the rows glide to their new ranks
  const growth = easeInOut(Math.min(fraction / (whole === 0 ? 1 : 0.6), 1));
  const shuffle = easeInOut(Math.min(Math.max((fraction - 0.5) / 0.4, 0), 1));

  const totalAt = (totals: number[], week: number) =>
    week <= 0 ? 0 : totals[Math.min(week, weekCount) - 1];
  // Start in week one's order while the bars grow from zero.
  const slotAt = (team: (typeof teams)[number], week: number) =>
    week <= 0
      ? team.ranks[0] - 1
      : team.ranks[Math.min(week, weekCount) - 1] - 1;

  const rows = teams.map((team) => {
    const fromTotal = totalAt(team.totals, whole);
    const fromSlot = slotAt(team, whole);
    const move = slotAt(team, whole + 1) - fromSlot;
    const slot = fromSlot + move * shuffle;
    return {
      team,
      total: fromTotal + (totalAt(team.totals, whole + 1) - fromTotal) * growth,
      slot,
      position: Math.round(slot),
      // Climbers pass over the teams they overtake
      climbing: move < 0,
      moving: shuffle > 0 && shuffle < 1 && move !== 0,
    };
  });
  const leaderTotal = Math.max(...rows.map((row) => row.total), 1);

  const rowHeight = compact ? 22 : 28;
  const { eaters, selfBuyer } = getSteakLine(teams.length);
  const shownWeek = time === 0 ? null : weeks[Math.ceil(time) - 1];
  const finished = time >= weekCount;

  const togglePlay = () => {
    if (finished) {
      introPending.current = true;
      setTime(0);
    }
    setPlaying((p) => !p || finished);
  };

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="mb-3 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : finished ? 'Replay' : 'Play'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-gray-950 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          {playing ? (
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="3" y="2" width="3.5" height="12" rx="1" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
            </svg>
          ) : finished ? (
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M3 8a5 5 0 1 0 1.5-3.6" />
              <path d="M3 2.5v2.5h2.5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 16 16"
              className="ml-0.5 h-4 w-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M4 2.5v11a1 1 0 0 0 1.5.9l9-5.5a1 1 0 0 0 0-1.8l-9-5.5A1 1 0 0 0 4 2.5Z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={weekCount}
          step={0.01}
          value={time}
          onChange={(event) => {
            setPlaying(false);
            const nextTime = Number(event.target.value);
            introPending.current = nextTime === 0;
            setTime(nextTime);
          }}
          aria-label="Week"
          aria-valuetext={shownWeek ? `Week ${shownWeek}` : 'Kickoff'}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-gray-800 accent-emerald-400"
        />
        <button
          type="button"
          onClick={() =>
            setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])
          }
          aria-label={`Speed ${speed} times`}
          className="h-7 w-10 shrink-0 rounded-md border border-gray-800 bg-gray-950 font-mono text-xs text-gray-400 tabular-nums hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {speed}×
        </button>
      </div>

      <div
        ref={ref}
        className="relative overflow-hidden rounded-lg border border-gray-800/60"
        style={{ height: teams.length * rowHeight }}
      >
        {/* Zone bands stay fixed while teams move through them */}
        {teams.map((_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="absolute inset-x-0"
            style={{
              top: index * rowHeight,
              height: rowHeight,
              backgroundColor: zoneBand[getSteakZone(index + 1, teams.length)],
            }}
          />
        ))}

        {/* The week, large and faint behind the bars */}
        <div
          aria-live="polite"
          className="pointer-events-none absolute bottom-1 right-2 z-[5] text-right font-mono font-bold leading-none text-gray-50/[0.09] tabular-nums"
        >
          <div className="text-[10px] sm:text-xs tracking-[0.3em]">
            {shownWeek ? 'WEEK' : ''}
          </div>
          <div className="text-6xl sm:text-8xl">{shownWeek ?? 'GO'}</div>
        </div>

        <SteakLine
          top={eaters * rowHeight}
          label="Steak line"
          color="emerald"
        />
        {selfBuyer && <SteakLine top={(eaters + 1) * rowHeight} color="red" />}

        {/* Rows */}
        {rows.map(({ team, total, slot, position, climbing, moving }) => {
          const zone = getSteakZone(position + 1, teams.length);
          const isSelected = team.id === selected;
          const { int, dec } = splitScore(total);
          return (
            <button
              type="button"
              key={team.id}
              onClick={() => onSelect(isSelected ? null : team.id)}
              aria-pressed={isSelected}
              className="absolute inset-x-0 top-0 flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
              style={{
                height: rowHeight,
                transform: `translateY(${slot * rowHeight}px)`,
                zIndex: isSelected ? 4 : climbing ? 2 : 1,
                // Solid so rows passing each other stay readable
                backgroundColor: zoneRow[zone],
                boxShadow: moving ? '0 2px 8px rgba(0, 0, 0, 0.6)' : undefined,
              }}
            >
              <span className="w-4 sm:w-5 shrink-0 text-right font-mono text-[10px] sm:text-xs text-gray-500 tabular-nums">
                {position + 1}
              </span>
              <span
                className={clsx(
                  'shrink-0 truncate text-[11px] sm:text-sm',
                  compact ? 'w-16' : 'w-36',
                  isSelected
                    ? 'font-bold text-amber-200'
                    : 'font-medium text-gray-200',
                )}
              >
                {compact ? team.shortName : team.name}
              </span>
              <span className="relative flex h-full min-w-0 flex-1 items-center">
                <span
                  className="h-[62%] rounded-r-[3px] rounded-l-[1px]"
                  style={{
                    // Leaves room for the total after the leader's bar
                    width: `${(total / leaderTotal) * (compact ? 70 : 82)}%`,
                    backgroundColor: isSelected ? '#fde68a' : zoneStroke[zone],
                    opacity: isSelected ? 1 : 0.75,
                  }}
                />
                <span className="ml-1 flex shrink-0 items-center gap-1 font-mono text-[10px] sm:text-xs text-gray-300 tabular-nums">
                  {position === 0 && total > 0 && (
                    <img
                      src="/steak.svg"
                      alt=""
                      aria-hidden="true"
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4 motion-safe:animate-[spin_3s_linear_infinite]"
                    />
                  )}
                  <span>
                    {Number(int).toLocaleString('en-US')}
                    <span className="text-[0.8em] text-gray-500">.{dec}</span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SteakLine({
  top,
  label,
  color,
}: {
  top: number;
  label?: string;
  color: 'emerald' | 'red';
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-[3]"
      style={{ top: top - 1 }}
    >
      <div
        className={clsx(
          'h-0.5',
          color === 'emerald'
            ? 'bg-[repeating-linear-gradient(90deg,rgba(52,211,153,0.8)_0_6px,transparent_6px_10px)]'
            : 'bg-[repeating-linear-gradient(90deg,rgba(248,113,113,0.6)_0_6px,transparent_6px_10px)]',
        )}
      />
      {label && (
        <span className="absolute right-1.5 -top-2 rounded bg-gray-950 px-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
          {label}
        </span>
      )}
    </div>
  );
}
