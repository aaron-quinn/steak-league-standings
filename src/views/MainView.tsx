import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import StandingsList from '../components/StandingsList';
import PlayoffLists from '../components/PlayoffLists';
import HistoryTabs from '../components/HistoryTabs';
import WeeklyScoreRanking from '../components/WeeklyScoreRanking';
import LeagueLogo from '../components/LeagueLogo';
import ViewSwitcher from '../components/ViewSwitcher';
import LoadingScreen from '../components/LoadingScreen';
import { useStandingsStore } from '../stores/standings';
import { getStandings, getWeek } from '../api';
import ErrorScreen from '@/components/ErrorScreen';

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

  const { data: standings, isLoading, isError } = useQuery({
    queryKey: ['standings', year, live],
    queryFn: () => getStandings(standingsAPIURL),
  });

  const { data: weekData } = useQuery({
    queryKey: ['week', year],
    queryFn: () => getWeek(year),
  });

  const currentWeek = weekData?.week;

  useEffect(() => {
    if (standings) {
      setStandings(standings);
    }
    setLive(live);
  }, [standings, live, setStandings, setLive]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError || !standings) {
    return <ErrorScreen />
  }

  return (
    <div className="bg-black min-h-screen py-3 px-2 sm:py-4 sm:px-3 lg:py-8 lg:px-8">
      <div className="w-full max-w-[375px] sm:max-w-none sm:w-fit mx-auto">
        {/* Header row - logo and view switcher */}
        <div className="flex items-center justify-between lg:justify-start gap-1.5 sm:gap-2 lg:gap-4 mb-3 sm:mb-4 lg:mb-6">
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
            {/* Weekly Score Ranking for Live View */}
            {live && (
              <div className="rounded-lg border border-gray-800/60 bg-gray-950/30">
                <WeeklyScoreRanking />
              </div>
            )}

            {/* Playoffs (priority 2) */}
            {currentWeek && currentWeek < 15 && <PlayoffLists />}

            {/* Steak History & Champions (tabbed) - Hidden during live view */}
            {!live && <HistoryTabs />}
          </div>
        </div>
      </div>
    </div>
  );
}
