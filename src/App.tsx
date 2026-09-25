import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import { usePrefetchQuery } from '@tanstack/react-query';
import LoadingScreen from './components/LoadingScreen';
import MainView from './views/MainView';
import MatchupView from './views/MatchupView';
import { getWeeklyScores } from './api/fun';
import { useStandingsStore } from './stores/standings';

// The Fun tab's charts are a large share of the app, so they load separately
// and the standings don't wait on them
const loadFunView = () => import('./views/FunView');
const loadSteakRaceView = () => import('./views/SteakRaceView');
const loadTopPlayersView = () => import('./views/TopPlayersView');

const FunView = lazy(loadFunView);
const SteakRaceView = lazy(loadSteakRaceView);
const TopPlayersView = lazy(loadTopPlayersView);

// Fetch them once the first page is up, so opening the tab doesn't show a
// loading screen
function usePrefetchFunViews() {
  useEffect(() => {
    const prefetch = () => {
      loadFunView();
      loadSteakRaceView();
      loadTopPlayersView();
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
      </Routes>
    </Suspense>
  );
}
