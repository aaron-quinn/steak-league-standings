import { useState } from 'react';
import clsx from 'clsx';
import SteakHistory from './SteakHistory';
import ChampionsList from './ChampionsList';

type Tab = 'steaks' | 'champions';

export default function HistoryTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('steaks');

  return (
    <div>
      <div className="flex bg-slate-700 rounded-t-md">
        <button
          onClick={() => setActiveTab('steaks')}
          className={clsx(
            'flex-1 py-2 px-3 text-sm font-bold rounded-tl-md transition-colors',
            activeTab === 'steaks'
              ? 'bg-slate-600 text-slate-200'
              : 'text-slate-400 hover:text-slate-300',
          )}
        >
          Steak Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('champions')}
          className={clsx(
            'flex-1 py-2 px-3 text-sm font-bold rounded-tr-md transition-colors',
            activeTab === 'champions'
              ? 'bg-slate-600 text-slate-200'
              : 'text-slate-400 hover:text-slate-300',
          )}
        >
          Champions
        </button>
      </div>
      <div className="bg-slate-800 rounded-b-md">
        {activeTab === 'steaks' ? <SteakHistory /> : <ChampionsList />}
      </div>
    </div>
  );
}
