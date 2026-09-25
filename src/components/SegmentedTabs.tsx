import clsx from 'clsx';
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator';

// The raised pill that slides under the active segment, shared with the
// view switcher so every toggle on the site moves the same way.
export const pillClassName =
  'absolute left-0 top-0.5 bottom-0.5 rounded-md border border-gray-700/60 bg-gray-800 opacity-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.6)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none';

interface Props<T extends string> {
  label: string;
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: Props<T>) {
  const { groupRef, indicatorRef } = useSlidingIndicator([value]);

  return (
    <div
      ref={groupRef}
      role="tablist"
      aria-label={label}
      className="relative flex rounded-lg border border-gray-800 bg-gray-950 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      <span ref={indicatorRef} aria-hidden="true" className={pillClassName} />
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active || undefined}
            onClick={() => onChange(tab.value)}
            className={clsx(
              'relative z-10 flex-1 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
              active ? 'text-gray-50' : 'text-gray-500 hover:text-gray-200',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
