import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoadingScreen from './components/LoadingScreen';
import MainView from './views/MainView';
import MatchupView from './views/MatchupView';
import FunView from './views/FunView';
import SteakRaceView from './views/SteakRaceView';
import TopPlayersView from './views/TopPlayersView';

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<MainView live={false} />} />
        <Route path="/live" element={<MainView live={true} />} />
        <Route path="/matchups" element={<MatchupView />} />
        <Route path="/fun" element={<FunView />} />
        <Route path="/fun/steak-race" element={<SteakRaceView />} />
        <Route
          path="/fun/top-players"
          element={<TopPlayersView key="top" bench={false} />}
        />
        <Route
          path="/fun/bench"
          element={<TopPlayersView key="bench" bench={true} />}
        />
      </Routes>
    </Suspense>
  );
}
