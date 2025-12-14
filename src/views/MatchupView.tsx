import { useQuery } from '@tanstack/react-query';
import LeagueLogo from '../components/LeagueLogo';
import ViewSwitcher from '../components/ViewSwitcher';
import LoadingScreen from '../components/LoadingScreen';
import { useStandingsStore } from '../stores/standings';
import { getMatchups } from '@/api/matchups';
import MatchupTeams from '@/components/MatchupTeams';
import { useEffect, useMemo, useState } from 'react';
import CurrentMatchup from '@/components/CurrentMatchup';
import getManagers from '@/data/managers';
import TeamMatchup from '@/types/TeamMatchup';

interface MatchupViewProps {}

export default function MatchupView({}: MatchupViewProps) {
  const year = useStandingsStore((state) => state.year);

  const matchupsAPIURL = `/live-matchups/${year}`;

  const { data: matchups, isLoading } = useQuery({
    queryKey: ['matchups', year],
    queryFn: () => getMatchups(matchupsAPIURL),
  });

  const [currentMatchup, setCurrentMatchup] = useState<number | null>(null);

  // Set currentMatchup based on URL param "id" if present, otherwise default to 0
  useEffect(() => {
    if (matchups) {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id');
      if (idParam) {
        const [team1, team2] = idParam.split('_');
        console.log('Looking for matchup with teams:', team1, team2);
        const foundIndex = matchups.findIndex(
          (m: TeamMatchup[]) =>
            m[0]?.franchiseID === team1 ||
            (team2 && m[1]?.franchiseID === team2),
        );
        if (foundIndex !== -1) {
          setCurrentMatchup(foundIndex);
          return;
        }
      }
      setCurrentMatchup(0);
    }
  }, [matchups, setCurrentMatchup]);

  const managersMap = useMemo(() => {
    const managers = getManagers();

    const steakManagers = managers
      .filter((t) => t.teams[year])
      .map((t) => {
        const teamYear = t.teams[year];
        const league = teamYear.league || '';
        const teamID = teamYear.teamID || '';
        const id = `${league.toLowerCase()}${teamID}`;
        return {
          id,
          name: t.name,
          teamID,
          steak: 'steak' in t.teams[year] || false,
        };
      });
    const teamMap = new Map<
      string,
      { id: string; name: string; teamID: string; steak: boolean }
    >();
    steakManagers.forEach((manager) => {
      teamMap.set(manager.id, manager);
    });
    return teamMap;
  }, [year]);

  if (isLoading || !matchups) {
    return <LoadingScreen title="Loading Matchups..." />;
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
        <div className="grid grid-cols-1 gap-4 lg:gap-6">
          {/* All Possible Matchups */}
          <MatchupTeams
            matchups={matchups}
            managersMap={managersMap}
            currentMatchup={currentMatchup}
            setCurrentMatchup={setCurrentMatchup}
          />
          {/* Current Matchup View */}
          {currentMatchup !== null && matchups[currentMatchup] ? (
            <CurrentMatchup
              matchup={matchups[currentMatchup]}
              managersMap={managersMap}
            />
          ) : (
            <div className="text-center text-gray-400 py-8">
              No matchup selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
