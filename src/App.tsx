import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoadingScreen from './components/LoadingScreen';
import MainView from './views/MainView';
import MatchupView from './views/MatchupView';

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<MainView live={false} />} />
        <Route path="/live" element={<MainView live={true} />} />
        <Route path="/matchups" element={<MatchupView />} />
      </Routes>
    </Suspense>
  );
}
