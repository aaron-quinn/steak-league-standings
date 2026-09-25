import { useState } from 'react';
import SteakHistory from './SteakHistory';
import ChampionsList from './ChampionsList';
import SectionLabel from './SectionLabel';
import SegmentedTabs from './SegmentedTabs';

type Tab = 'steaks' | 'champions';

export default function HistoryTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('steaks');

  return (
    <section aria-label="League history">
      <SectionLabel>History</SectionLabel>
      <div className="rounded-lg border border-gray-800/60 bg-gray-950/30">
        <div className="p-1.5 sm:p-2 border-b border-gray-800/60">
          <SegmentedTabs
            label="History"
            tabs={[
              { value: 'steaks', label: 'Steak Leaders' },
              { value: 'champions', label: 'Champions' },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>
        {activeTab === 'steaks' ? <SteakHistory /> : <ChampionsList />}
      </div>
    </section>
  );
}
