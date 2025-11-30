import { useState } from 'react';
import clsx from 'clsx';
import SteakHistory from './SteakHistory';
import ChampionsList from './ChampionsList';

type Tab = 'steaks' | 'champions';

export default function HistoryTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('steaks');

  return (
    <div className="rounded-lg overflow-hidden border border-gray-800/60">
      <div className="flex border-b border-gray-800/60">
        <button
          onClick={() => setActiveTab('steaks')}
          className={clsx(
            'flex-1 py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
            activeTab === 'steaks'
              ? 'text-blue-400/80 bg-blue-950/20'
              : 'text-gray-500 hover:text-gray-400',
          )}
        >
          Steak Leaders
        </button>
        <button
          onClick={() => setActiveTab('champions')}
          className={clsx(
            'flex-1 py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium transition-colors',
            activeTab === 'champions'
              ? 'text-blue-400/80 bg-blue-950/20'
              : 'text-gray-500 hover:text-gray-400',
          )}
        >
          Champions
        </button>
      </div>
      <div>{activeTab === 'steaks' ? <SteakHistory /> : <ChampionsList />}</div>
    </div>
  );
}
