import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import StandingsList from '../components/StandingsList';
import type { StandingsListHandle } from '../components/StandingsList';
import PlayoffLists from '../components/PlayoffLists';
import HistoryTabs from '../components/HistoryTabs';
import WeeklyScoreRanking from '../components/WeeklyScoreRanking';
import LeagueLogo from '../components/LeagueLogo';
import ViewSwitcher from '../components/ViewSwitcher';
import HeaderStatus from '../components/HeaderStatus';
import LoadingScreen from '../components/LoadingScreen';
import { useStandingsStore } from '../stores/standings';
import { getStandings, getWeek } from '../api';
import ErrorScreen from '@/components/ErrorScreen';
import type { StandingsData } from '../types/StandingsData';

interface MainViewProps {
  live: boolean;
}

export default function MainView({ live }: MainViewProps) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [projected, setProjected] = useState(
    () => searchParams.get('view') === 'projected',
  );
  const standingsListRef = useRef<StandingsListHandle>(null);
  const prevLiveRef = useRef(live);
  const year = useStandingsStore((state) => state.year);
  const setStandingsSnapshot = useStandingsStore(
    (state) => state.setStandingsSnapshot,
  );

  const standingsAPIURL = live
    ? `/live-standings/${year}`
    : `/standings/${year}`;

  const {
    data: standings,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['standings', year, live],
    queryFn: () => getStandings(standingsAPIURL),
  });

  const { data: weekData } = useQuery({
    queryKey: ['week', year],
    queryFn: () => getWeek(year),
  });

  const currentWeek = weekData?.week;
  const previousStandings = queryClient.getQueryData<StandingsData>([
    'standings',
    year,
    !live,
  ]);
  const displayedStandings = standings ?? previousStandings;
  const displayedLive = standings ? live : previousStandings ? !live : live;
  const showingPreviousStandings = !standings && Boolean(previousStandings);
  const teams = standings ? Object.values(standings) : [];
  const projectionsAvailable =
    live &&
    teams.length > 0 &&
    teams.every((team) => team.projectedRemaining !== undefined);
  const displayedTeams = displayedStandings
    ? Object.values(displayedStandings)
    : [];
  const displayedProjectionsAvailable =
    displayedLive &&
    displayedTeams.length > 0 &&
    displayedTeams.every((team) => team.projectedRemaining !== undefined);
  const displayedProjectedView = projected && displayedProjectionsAvailable;

  const wantProjected = searchParams.get('view') === 'projected';

  const handleNavigate = () => {
    standingsListRef.current?.capturePositions();
  };

  // Animate row reordering when moving between Official and Live views
  // (logo clicks, back/forward). Toggle clicks are captured via onNavigate.
  useEffect(() => {
    if (prevLiveRef.current !== live) {
      prevLiveRef.current = live;
      standingsListRef.current?.capturePositions();
    }
  }, [live]);

  useEffect(() => {
    if (wantProjected && projectionsAvailable && !projected) {
      standingsListRef.current?.capturePositions();
      setProjected(true);
    } else if (!wantProjected && projected) {
      standingsListRef.current?.capturePositions();
      setProjected(false);
    }
  }, [searchParams, projectionsAvailable, projected]);

  useLayoutEffect(() => {
    if (displayedStandings) {
      setStandingsSnapshot(displayedStandings, displayedLive);
    }
  }, [displayedStandings, displayedLive, setStandingsSnapshot]);

  useEffect(() => {
    if (standings && !displayedLive) setProjected(false);
  }, [standings, displayedLive]);

  if (isError) {
    return <ErrorScreen />;
  }

  if (!displayedStandings) {
    return <LoadingScreen />;
  }

  return (
    <div className="bg-black min-h-screen py-3 px-2 sm:py-4 sm:px-3 lg:py-8 lg:px-8">
      <div className="w-full max-w-[375px] sm:max-w-6xl mx-auto">
        {/* Header row - logo and view switcher */}
        <div className="flex items-end justify-between lg:justify-start gap-1.5 sm:gap-2 lg:gap-4 mb-3 sm:mb-4 lg:mb-6 max-[350px]:flex-col max-[350px]:items-start">
          <div className="flex h-8 lg:h-10 shrink-0 items-center">
            <LeagueLogo />
          </div>
          {/* Official standings carry no projection data, so from here
              Projected links out to the live view, which falls back to
              current scores if projections are unavailable. */}
          <ViewSwitcher
            projectionsAvailable={live ? projectionsAvailable : true}
            onNavigate={handleNavigate}
          />
          <HeaderStatus
            week={currentWeek}
            official={!displayedLive}
            updatedAt={standings ? dataUpdatedAt : undefined}
            inProgress={
              displayedLive &&
              displayedTeams.some((team) => (team.inProgress ?? 0) > 0)
            }
          />
        </div>

        {showingPreviousStandings && (
          <span className="sr-only" role="status">
            Updating standings
          </span>
        )}

        {/* Main content grid */}
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6"
          aria-busy={showingPreviousStandings}
        >
          {/* Primary column - Standings (always visible, priority 1) */}
          <div className="lg:col-span-7 xl:col-span-8">
            <StandingsList
              ref={standingsListRef}
              projected={displayedProjectedView}
            />
          </div>

          {/* Secondary column - Playoffs & History */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            {/* Weekly Score Ranking for Live View */}
            {displayedLive && (
              <WeeklyScoreRanking projected={displayedProjectedView} />
            )}

            {/* Playoffs (priority 2) */}
            {/* No games played yet means there is no playoff picture to show */}
            {currentWeek && currentWeek > 1 && currentWeek < 15 && (
              <PlayoffLists />
            )}

            {/* Steak History & Champions (tabbed) - Hidden during live view */}
            {!displayedLive && <HistoryTabs />}
          </div>
        </div>
      </div>
    </div>
  );
}
