import { Route, Routes } from 'react-router-dom';
import BuildsPage from './pages/BuildsPage';
import DraftPage from './pages/DraftPage';
import ManagerPage from './pages/ManagerPage';
import ManagersPage from './pages/ManagersPage';
import OddsPage from './pages/OddsPage';
import RacePage from './pages/RacePage';
import StandingsPage from './pages/StandingsPage';
import TradesPage from './pages/TradesPage';
import WaiversPage from './pages/WaiversPage';
import './nba.css';

// Everything under /nba/. Loaded on its own, so the NFL pages never download
// any of it.
export default function NbaApp() {
  return (
    <Routes>
      <Route index element={<StandingsPage />} />
      <Route path="race" element={<RacePage />} />
      <Route path="odds" element={<OddsPage />} />
      <Route path="draft" element={<DraftPage />} />
      <Route path="waivers" element={<WaiversPage />} />
      <Route path="trades" element={<TradesPage />} />
      <Route path="builds" element={<BuildsPage />} />
      <Route path="managers"element={<ManagersPage />} />
      <Route path="managers/:slug" element={<ManagerPage />} />
      <Route path="*" element={<StandingsPage />} />
    </Routes>
  );
}
