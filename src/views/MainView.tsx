import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import StandingsList from '../components/StandingsList';
import PlayoffLists from '../components/PlayoffLists';
import ChampionsList from '../components/ChampionsList';
import SteakHistory from '../components/SteakHistory';
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
    <div className="bg-slate-900 py-6 lg:py-10 lg:px-10">
      <div className="max-w-8xl m-auto grid grids-cols-2 lg:grid-cols-10 gap-4 lg:gap-10">
        <div className="col-span-1 lg:col-span-3">
          <LeagueLogo />
          <ChampionsList />
          <SteakHistory />
        </div>
        <div className="col-span-1 lg:col-span-7">
          <ViewSwitcher />
          <StandingsList />
          <div className="flex justify-between">
            {!live && <PlayoffLists />}
          </div>
        </div>
      </div>
    </div>
  );
}
