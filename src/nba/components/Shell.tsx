import { NavLink, useSearchParams } from 'react-router-dom';
import { DEFAULT_SEASON, SEASONS, seasonLabel } from '../lib/season';
import SportSwitch from '../../components/SportSwitch';
import Basketball from './Basketball';

export const NBA_SCREENS = [
  { to: '/nba', label: 'Standings' },
  { to: '/nba/race', label: 'Steak Race' },
  { to: '/nba/odds', label: 'Steak Odds' },
  { to: '/nba/draft', label: 'Draft' },
  { to: '/nba/waivers', label: 'Waivers' },
  { to: '/nba/trades', label: 'Trades' },
  { to: '/nba/builds', label: 'Builds' },
  // Stays lit on each manager's own page
  { to: '/nba/managers', label: 'Managers', nested: true },
];

// The season in the URL (?season=2025), or the default one
export function useSeason(): [number, (season: number) => void] {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('season'));
  const season = SEASONS.includes(requested) ? requested : DEFAULT_SEASON;
  const setSeason = (next: number) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === DEFAULT_SEASON) p.delete('season');
        else p.set('season', String(next));
        return p;
      },
      { replace: true },
    );
  return [season, setSeason];
}

// ?view=all puts a screen in its all-time mode
export function useAllTime(): [boolean, (allTime: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const allTime = params.get('view') === 'all';
  const setAllTime = (next: boolean) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next) p.set('view', 'all');
        else p.delete('view');
        return p;
      },
      { replace: true },
    );
  return [allTime, setAllTime];
}

// Season / All-Time, for the screens that have both
export function AllTimeToggle() {
  const [allTime, setAllTime] = useAllTime();
  return (
    <div className="nba-seg" role="group" aria-label="Season or all time">
      <button aria-pressed={!allTime} onClick={() => setAllTime(false)}>
        Season
      </button>
      <button aria-pressed={allTime} onClick={() => setAllTime(true)}>
        All-Time
      </button>
    </div>
  );
}

export function SeasonPicker({
  seasons = SEASONS,
}: {
  seasons?: number[];
}) {
  const [season, setSeason] = useSeason();
  return (
    <label className="nba-season">
      <span className="sr-only">Season</span>
      <select
        value={season}
        onChange={(e) => setSeason(Number(e.target.value))}
      >
        {seasons.map((s) => (
          <option key={s} value={s}>
            {seasonLabel(s)}
          </option>
        ))}
      </select>
    </label>
  );
}

interface ShellProps {
  title: string;
  status?: React.ReactNode;
  // Defaults to the season picker
  tools?: React.ReactNode;
  children: React.ReactNode;
}

export default function Shell({ title, status, tools, children }: ShellProps) {
  const [params] = useSearchParams();
  // Keep the chosen season when moving between screens
  const query = params.get('season') ? `?season=${params.get('season')}` : '';
  return (
    <div className="nba">
      <div className="nba-page">
        <header className="nba-top">
          <div className="nba-masthead">
            {/* The wordmark opens the league menu; NBA in it leads back to
                the standings, keeping the season */}
            <SportSwitch
              current="nba"
              currentTo={`/nba${query}`}
              className="nba-league"
              triggerClassName="nba-league-trigger"
              menuClassName="nba-league-menu"
            >
              <span className="nba-wordmark">
                <Basketball />
                Steak <span>NBA</span>
              </span>
            </SportSwitch>
          </div>
          <nav className="nba-nav" aria-label="NBA screens">
            {NBA_SCREENS.map((screen) => (
              <NavLink key={screen.to} to={`${screen.to}${query}`} end={!('nested' in screen)}>
                {screen.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <div className="nba-head">
          <div>
            <h2 className="nba-title">{title}</h2>
            {status && <div className="nba-status">{status}</div>}
          </div>
          {tools ?? <SeasonPicker />}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="nba-loading" role="status">
      <span>{label}…</span>
    </div>
  );
}
