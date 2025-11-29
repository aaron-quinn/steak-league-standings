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
      <nav className="flex space-x-1 lg:space-x-2" aria-label="Tabs">
        {tabs.map((tab) => (
          <a
            key={tab.name}
            href={tab.href}
            className={clsx(
              'px-2.5 py-1.5 lg:px-4 lg:py-2 font-medium text-xs lg:text-sm rounded-lg whitespace-nowrap transition-all duration-200',
              tab.current
                ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                : 'text-navy-400 hover:text-accent-400 hover:bg-navy-900/50',
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
