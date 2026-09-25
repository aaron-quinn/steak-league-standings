import clsx from 'clsx';
import { Link, useLocation } from 'react-router-dom';
import { useSlidingIndicator } from '@/hooks/useSlidingIndicator';
import { pillClassName } from '../SegmentedTabs';

export const FUN_SCREENS = [
  {
    to: '/fun/steak-race',
    label: 'Steak Race',
    description: 'Every team’s official steak rank, week by week.',
  },
  {
    to: '/fun/top-players',
    label: 'Top Players',
    description: 'The week’s biggest fantasy scorers and who rosters them.',
  },
  {
    to: '/fun/bench',
    label: 'Bench Points',
    description: 'The best performances left sitting on a bench.',
  },
];

// Moves between the Fun screens. Each screen renders its own copy, so the
// pill's last position lives here to let it slide across pages.
const lastIndicator = {
  current: null as { left: number; width: number } | null,
};

export default function FunNav() {
  const { pathname, search } = useLocation();
  // Keep following the same team when moving between screens
  const follow = new URLSearchParams(search).get('follow');
  const query = follow ? `?${new URLSearchParams({ follow })}` : '';
  const { groupRef, indicatorRef } = useSlidingIndicator(
    [pathname],
    lastIndicator,
  );

  return (
    <nav aria-label="Fun screens" className="mb-4 lg:mb-6">
      <div
        ref={groupRef}
        className="relative flex rounded-lg border border-gray-800 bg-gray-950 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:inline-flex"
      >
        <span ref={indicatorRef} aria-hidden="true" className={pillClassName} />
        {FUN_SCREENS.map((screen) => {
          const active = pathname === screen.to;
          return (
            <Link
              key={screen.to}
              to={`${screen.to}${query}`}
              aria-current={active ? 'page' : undefined}
              data-active={active || undefined}
              className={clsx(
                'relative z-10 flex-1 rounded-md px-2 sm:px-4 py-1 sm:py-1.5 text-center text-xs sm:text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                active ? 'text-gray-50' : 'text-gray-500 hover:text-gray-200',
              )}
            >
              {screen.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
