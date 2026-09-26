import clsx from 'clsx';
import { POSITION_FILTERS, type PositionFilter } from '@/utils/week-players';

interface Props {
  value: PositionFilter;
  onChange: (value: PositionFilter) => void;
  className?: string;
}

// Position filter chips, scrolling sideways on narrow screens
export default function PositionFilters({ value, onChange, className }: Props) {
  return (
    <div
      role="group"
      aria-label="Position"
      className={clsx(
        '-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {POSITION_FILTERS.map((filter) => {
        const active = filter.value === value;
        return (
          <button
            type="button"
            key={filter.value}
            aria-pressed={active}
            onClick={() => onChange(filter.value)}
            className={clsx(
              'h-7 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
              active
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700 hover:text-gray-200',
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
