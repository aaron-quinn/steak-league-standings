import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import StandingsList from '../components/StandingsList';
import PlayoffLists from '../components/PlayoffLists';
import HistoryTabs from '../components/HistoryTabs';
import LeagueLogo from '../components/LeagueLogo';
import ViewSwitcher from '../components/ViewSwitcher';
import LoadingScreen from '../components/LoadingScreen';
import { useStandingsStore } from '../stores/standings';
import { getStandings } from '../api';

interface MainViewProps {
  live: boolean;
}

export default function MainView({ live }: MainViewProps) {
  const year = useStandingsStore((state) => state.year);
  const setStandings = useStandingsStore((state) => state.setStandings);
  const setLive = useStandingsStore((state) => state.setLive);

  const standingsAPIURL = live
    ? `/live-standings/${year}`
    : `/standings/${year}`;

  const { data: standings, isLoading } = useQuery({
    queryKey: ['standings', year, live],
    queryFn: () => getStandings(standingsAPIURL),
  });

  useEffect(() => {
    if (standings) {
      setStandings(standings);
    }
    setLive(live);
  }, [standings, live, setStandings, setLive]);

  if (isLoading || !standings) {
    return <LoadingScreen />;
  }

  return (
    <div className="bg-black min-h-screen py-4 px-3 lg:py-8 lg:px-8">
      <div className="w-fit mx-auto">
        {/* Header row - logo and view switcher */}
        <div className="flex items-center justify-between lg:justify-start gap-2 lg:gap-4 mb-4 lg:mb-6">
          <LeagueLogo />
          <ViewSwitcher />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Primary column - Standings (always visible, priority 1) */}
          <div className="lg:col-span-7 xl:col-span-8">
            <StandingsList />
          </div>

          {/* Secondary column - Playoffs & History */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            {/* Playoffs (priority 2) */}
            {!live && <PlayoffLists />}

            {/* Steak History & Champions (tabbed) */}
            <HistoryTabs />
          </div>
        </div>
      </div>
    </div>
  );
}
