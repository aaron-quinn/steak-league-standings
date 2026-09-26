import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import { usePrefetchQuery, useQueryClient } from '@tanstack/react-query';
import LoadingScreen from './components/LoadingScreen';
import MainView from './views/MainView';
import MatchupView from './views/MatchupView';
import { getDraft, getWeeklyScores } from './api/fun';
import { useStandingsStore } from './stores/standings';

// The Fun tab's charts are a large share of the app, so they load separately
// and the standings don't wait on them
const loadFunView = () => import('./views/FunView');
const loadSteakRaceView = () => import('./views/SteakRaceView');
const loadSteakOddsView = () => import('./views/SteakOddsView');
const loadTopPlayersView = () => import('./views/TopPlayersView');
const loadDraftView = () => import('./views/DraftView');
const loadWaiversView = () => import('./views/WaiversView');

const FunView = lazy(loadFunView);
const SteakRaceView = lazy(loadSteakRaceView);
const SteakOddsView = lazy(loadSteakOddsView);
const TopPlayersView = lazy(loadTopPlayersView);
const DraftView = lazy(loadDraftView);
const WaiversView = lazy(loadWaiversView);

// Fetch them once the first page is up, so opening the tab doesn't show a
// loading screen
function usePrefetchFunViews() {
  useEffect(() => {
    const prefetch = () => {
      loadFunView();
      loadSteakRaceView();
      loadSteakOddsView();
      loadTopPlayersView();
      loadDraftView();
      loadWaiversView();
    };
    // Older Safari has no requestIdleCallback
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2000);
    return () => clearTimeout(id);
  }, []);
}

// Every Fun screen needs the season's weekly scores. Ask for them here, above
// the lazy screen, so they load alongside its code rather than after it, and
// are usually ready by the time someone taps through from the Fun tab.
function WithWeeklyScores({ children }: { children: React.ReactNode }) {
  const currentYear = useStandingsStore((state) => state.year);
  const [searchParams] = useSearchParams();
  const requested = Number(searchParams.get('season'));
  const year =
    requested >= 2021 && requested <= currentYear ? requested : currentYear;
  usePrefetchQuery({
    queryKey: ['weekly-scores', year],
    queryFn: () => getWeeklyScores(year),
  });
  return children;
}

// The odds screen learns from past seasons, so it needs every season's scores
function WithSteakHistory({ children }: { children: React.ReactNode }) {
  const currentYear = useStandingsStore((state) => state.year);
  const queryClient = useQueryClient();
  for (let year = 2021; year <= currentYear; year++) {
    const queryKey = ['weekly-scores', year];
    if (!queryClient.getQueryState(queryKey)) {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => getWeeklyScores(year),
      });
    }
  }
  return children;
}

// The same for the draft screen, which needs the draft values instead
function WithDraft({ children }: { children: React.ReactNode }) {
  const year = useStandingsStore((state) => state.year);
  usePrefetchQuery({
    queryKey: ['draft', year],
    queryFn: () => getDraft(year),
  });
  return children;
}

export default function App() {
  usePrefetchFunViews();

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<MainView live={false} />} />
        <Route path="/live" element={<MainView live={true} />} />
        <Route path="/matchups" element={<MatchupView />} />
        <Route
          path="/fun"
          element={
            <WithWeeklyScores>
              <FunView />
            </WithWeeklyScores>
          }
        />
        <Route
          path="/fun/steak-race"
          element={
            <WithWeeklyScores>
              <SteakRaceView />
            </WithWeeklyScores>
          }
        />
        <Route
          path="/fun/steak-odds"
          element={
            <WithSteakHistory>
              <SteakOddsView />
            </WithSteakHistory>
          }
        />
        <Route
          path="/fun/top-players"
          element={
            <WithWeeklyScores>
              <TopPlayersView key="top" bench={false} />
            </WithWeeklyScores>
          }
        />
        <Route
          path="/fun/bench"
          element={
            <WithWeeklyScores>
              <TopPlayersView key="bench" bench={true} />
            </WithWeeklyScores>
          }
        />
        <Route
          path="/fun/draft"
          element={
            <WithDraft>
              <DraftView />
            </WithDraft>
          }
        />
        <Route path="/fun/waivers" element={<WaiversView />} />
      </Routes>
    </Suspense>
  );
}
