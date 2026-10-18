import clsx from 'clsx';
import { ordinal } from '@/utils/format-score';
import type { CareerSeason } from '@/utils/manager-careers';
import type { SteakZone } from '@/utils/steak-teams';

const blockColor: Record<SteakZone, string> = {
  eater: 'bg-emerald-400 text-emerald-950',
  'self-buyer': 'bg-gray-400 text-gray-950',
  buyer: 'bg-red-400 text-red-950',
};

// One column per steak rank, one block per finished season stacked in it.
// The pool grew from 18 to 19 teams in 2021 (bringing in a self-buyer), so
// each block takes the zone of its own season.
export default function FinishHistogram({
  seasons,
}: {
  seasons: CareerSeason[];
}) {
  const places = Math.max(...seasons.map((s) => s.poolSize));
  const columns = Array.from({ length: places }, (_, i) =>
    seasons.filter((s) => s.rank === i + 1).sort((a, b) => a.year - b.year),
  );
  // At least three blocks of headroom, so one-off finishes don't look squat
  const tallest = Math.max(3, ...columns.map((c) => c.length));
  const summary = columns
    .map((c, i) => (c.length ? `${ordinal(i + 1)} ×${c.length}` : null))
    .filter(Boolean)
    .join(', ');

  return (
    <figure aria-label={`Steak finishes: ${summary}`} className="m-0">
      <div
        className="grid gap-px sm:gap-0.5"
        style={{ gridTemplateColumns: `repeat(${places}, minmax(0, 1fr))` }}
      >
        {columns.map((column, i) => (
          <div
            key={i}
            className="flex flex-col-reverse gap-px sm:gap-0.5"
            style={{ height: `${tallest * 24}px` }}
          >
            {column.map((s) => (
              <span
                key={s.year}
                title={`${s.year}: ${ordinal(s.rank!)} of ${s.poolSize}`}
                className={clsx(
                  'grid h-[22px] place-items-center rounded-sm font-mono text-[9px] font-semibold tabular-nums',
                  blockColor[s.zone!],
                )}
              >
                <span className="hidden sm:inline">
                  {String(s.year).slice(2)}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-1.5 grid gap-px sm:gap-0.5 border-t border-gray-800 pt-1"
        style={{ gridTemplateColumns: `repeat(${places}, minmax(0, 1fr))` }}
      >
        {columns.map((_, i) => (
          <span
            key={i}
            className={clsx(
              'text-center font-mono text-[9px] sm:text-[10px] text-gray-500 tabular-nums',
              // Phones only have room for every fifth place
              i + 1 !== 1 && (i + 1) % 5 !== 0 && 'invisible sm:visible',
            )}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 text-[11px] text-gray-500">
        Steak rank each finished season, labeled by year:{' '}
        <span className="text-emerald-400">ate</span> ·{' '}
        <span className="text-gray-400">bought own</span> ·{' '}
        <span className="text-red-400">bought</span>
      </figcaption>
    </figure>
  );
}
