import clsx from 'clsx';
import { Link, useLocation } from 'react-router-dom';
import {
  useSlidingIndicator,
  type IndicatorPosition,
} from '@/hooks/useSlidingIndicator';
import { pillClassName } from './SegmentedTabs';

interface ViewSwitcherProps {
  projectionsAvailable?: boolean;
  onNavigate?: () => void;
}

// Each view renders its own switcher, so the pill's last position lives
// outside the component to let it slide across page changes.
const lastIndicator: { current: IndicatorPosition } = { current: null };

export default function ViewSwitcher({
  projectionsAvailable = true,
  onNavigate,
}: ViewSwitcherProps) {
  const { pathname, search } = useLocation();
  const isOfficial = pathname === '/';
  const isLive = pathname === '/live';
  const isMatchups = pathname === '/matchups';
  const isFun = pathname === '/fun' || pathname.startsWith('/fun/');
  const wantsProjected =
    new URLSearchParams(search).get('view') === 'projected';
  const isProjected = isLive && wantsProjected && projectionsAvailable;
  const isLiveCurrent = isLive && !isProjected;

  const activeKey = isOfficial
    ? 'official'
    : isLiveCurrent
      ? 'live'
      : isProjected
        ? 'projected'
        : isMatchups
          ? 'matchups'
          : isFun
            ? 'fun'
            : null;

  const { groupRef, indicatorRef } = useSlidingIndicator(
    [activeKey, projectionsAvailable],
    lastIndicator,
  );

  const segmentClasses =
    'relative z-10 inline-flex h-7 sm:h-6 lg:h-8 flex-1 sm:flex-none items-center justify-center rounded-md px-1.5 sm:px-2.5 lg:px-3 text-[11px] sm:text-xs lg:text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
  const activeClasses = 'text-gray-50';
  const inactiveClasses = 'text-gray-500 hover:text-gray-200';

  const segment = (key: string, to: string, label: string) => {
    const active = activeKey === key;
    return (
      <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        data-active={active || undefined}
        onClick={active ? undefined : onNavigate}
        className={clsx(
          segmentClasses,
          active ? activeClasses : inactiveClasses,
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      // Fills the header row on phones so every tab is a comfortable target
      className="flex h-8 lg:h-10 min-w-0 flex-1 sm:flex-none items-center antialiased max-[350px]:w-full"
      aria-label="Standings views"
    >
      <div
        ref={groupRef}
        className="relative flex w-full sm:w-auto sm:inline-flex h-8 lg:h-10 items-center rounded-lg border border-gray-800 bg-gray-950 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        role="group"
        aria-label="Standings mode"
      >
        <span ref={indicatorRef} aria-hidden="true" className={pillClassName} />
        {segment('official', '/', 'Official')}
        {segment('live', '/live', 'Live')}
        {projectionsAvailable ? (
          segment('projected', '/live?view=projected', 'Projected')
        ) : (
          <button
            type="button"
            disabled
            title="Player projections are unavailable"
            className={clsx(
              segmentClasses,
              'text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            Projected
          </button>
        )}
        <span
          aria-hidden="true"
          className="mx-0.5 h-3.5 lg:h-4 w-px shrink-0 bg-gray-800"
        />
        {segment('matchups', '/matchups', 'Matchups')}
        {segment('fun', '/fun', 'Fun')}
      </div>
    </nav>
  );
}
