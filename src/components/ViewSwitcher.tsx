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
              'px-2 py-1.5 lg:px-3 lg:py-2 font-medium text-xs lg:text-sm rounded-md whitespace-nowrap',
              tab.current
                ? 'bg-slate-200 text-slate-800'
                : 'text-slate-200 hover:text-slate-50',
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
