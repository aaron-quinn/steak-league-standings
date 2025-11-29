import { useState } from 'react';
import clsx from 'clsx';
import SteakHistory from './SteakHistory';
import ChampionsList from './ChampionsList';

type Tab = 'steaks' | 'champions';

export default function HistoryTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('steaks');

  return (
    <div className="rounded-xl overflow-hidden border border-navy-800/50 shadow-xl shadow-black/30">
      <div className="flex bg-navy-900">
        <button
          onClick={() => setActiveTab('steaks')}
          className={clsx(
            'flex-1 py-2.5 px-3 text-sm font-semibold transition-all duration-200',
            activeTab === 'steaks'
              ? 'bg-navy-950 text-accent-400 border-b-2 border-accent-500'
              : 'text-navy-400 hover:text-accent-300',
          )}
        >
          Steak Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('champions')}
          className={clsx(
            'flex-1 py-2.5 px-3 text-sm font-semibold transition-all duration-200',
            activeTab === 'champions'
              ? 'bg-navy-950 text-accent-400 border-b-2 border-accent-500'
              : 'text-navy-400 hover:text-accent-300',
          )}
        >
          Champions
        </button>
      </div>
      <div className="bg-navy-950">
        {activeTab === 'steaks' ? <SteakHistory /> : <ChampionsList />}
      </div>
    </div>
  );
}
