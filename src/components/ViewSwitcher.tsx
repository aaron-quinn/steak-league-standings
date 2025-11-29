import clsx from 'clsx';
import { useStandingsStore } from '../stores/standings';

export default function ViewSwitcher() {
  const live = useStandingsStore((state) => state.live);

  const tabs = [
    { name: 'Official Standings', href: '/', current: !live },
    { name: 'Live Standings', href: '/live', current: live },
  ];

  return (
    <div className="mb-6 antialiased">
      <div className="block">
        <nav
          className="flex space-x-4 justify-center lg:justify-start"
          aria-label="Tabs"
        >
          {tabs.map((tab) => (
            <a
              key={tab.name}
              href={tab.href}
              className={clsx(
                'px-3 py-2 font-medium text-base rounded-md',
                tab.current
                  ? 'bg-slate-200 text-slate-800'
                  : 'text-slate-200 hover:text-slate-50'
              )}
              aria-current={tab.current ? 'page' : undefined}
            >
              {tab.name}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
