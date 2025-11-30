import clsx from 'clsx';
import { useStandingsStore } from '../stores/standings';

export default function ViewSwitcher() {
  const live = useStandingsStore((state) => state.live);

  const tabs = [
    {
      name: 'Official',
      fullName: 'Official Standings',
      href: '/',
      current: !live,
    },
    { name: 'Live', fullName: 'Live Standings', href: '/live', current: live },
  ];

  return (
    <div className="antialiased">
      <nav className="flex space-x-0.5 sm:space-x-1" aria-label="Tabs">
        {tabs.map((tab) => (
          <a
            key={tab.name}
            href={tab.href}
            className={clsx(
              'px-2 py-1 sm:px-2.5 sm:py-1.5 lg:px-3 lg:py-1.5 font-medium text-[11px] sm:text-xs lg:text-sm rounded-md whitespace-nowrap transition-colors',
              tab.current
                ? 'bg-blue-600/80 text-gray-100'
                : 'text-gray-500 hover:text-blue-400/80',
            )}
            aria-current={tab.current ? 'page' : undefined}
          >
            <span className="lg:hidden">{tab.name}</span>
            <span className="hidden lg:inline">{tab.fullName}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
