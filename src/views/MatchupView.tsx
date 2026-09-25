import { keepPreviousData, useQuery } from '@tanstack/react-query';
import LeagueLogo from '../components/LeagueLogo';
import ViewSwitcher from '../components/ViewSwitcher';
import { useStandingsStore } from '../stores/standings';
import { getMatchups } from '@/api/matchups';
import { getWeek } from '@/api';
import MatchupTeams from '@/components/MatchupTeams';
import { useEffect, useMemo, useState } from 'react';
import CurrentMatchup from '@/components/CurrentMatchup';
import ErrorScreen from '@/components/ErrorScreen';
import MatchupsPlaceholder from '@/components/MatchupsPlaceholder';
import MatchupsSkeleton from '@/components/MatchupsSkeleton';
import SectionLabel from '@/components/SectionLabel';
import HeaderStatus from '@/components/HeaderStatus';
import getManagers from '@/data/managers';
import TeamMatchup from '@/types/TeamMatchup';

interface MatchupViewProps {}

export default function MatchupView({}: MatchupViewProps) {
  const year = useStandingsStore((state) => state.year);

  const matchupsAPIURL = `/live-matchups/${year}`;

  const {
    data: matchups,
    isError,
    isFetching,
    isPlaceholderData,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['matchups', year],
    queryFn: () => getMatchups(matchupsAPIURL),
    placeholderData: keepPreviousData,
  });

  const { data: weekData } = useQuery({
    queryKey: ['week', year],
    queryFn: () => getWeek(year),
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

  if (isError && !matchups) {
    return (
      <ErrorScreen
        title="Matchups Unavailable"
        message="We were unable to load the matchup data. Please try again later."
      />
    );
  }

  if (!matchups) {
    return (
      <PageShell>
        <MatchupsSkeleton />
      </PageShell>
    );
  }

  const showingPreviousMatchups = isPlaceholderData && isFetching;

  const hasMatchups = matchups.length > 0;

  return (
    <PageShell
      status={
        <HeaderStatus
          week={weekData?.week}
          updatedAt={showingPreviousMatchups ? undefined : dataUpdatedAt}
          inProgress={matchups.some((matchup) =>
            matchup.some((team) => team.inProgress > 0),
          )}
        />
      }
    >
      {showingPreviousMatchups && (
        <span className="sr-only" role="status">
          Updating matchups
        </span>
      )}

      <div
        className="grid grid-cols-1 gap-6 lg:gap-8"
        aria-busy={showingPreviousMatchups}
      >
        {!hasMatchups ? (
          <MatchupsPlaceholder />
        ) : (
          <>
            {/* All Possible Matchups */}
            <div>
              <SectionLabel tone="green">
                {weekData?.week ? `Week ${weekData.week}` : 'Scoreboard'}
              </SectionLabel>
              <MatchupTeams
                matchups={matchups}
                managersMap={managersMap}
                currentMatchup={currentMatchup}
                setCurrentMatchup={setCurrentMatchup}
              />
            </div>
            {/* Current Matchup View */}
            {currentMatchup !== null && matchups[currentMatchup] ? (
              <CurrentMatchup
                matchup={matchups[currentMatchup]}
                managersMap={managersMap}
              />
            ) : (
              <div className="text-center text-sm text-gray-500 py-8">
                No matchup selected.
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

function PageShell({
  children,
  status,
}: {
  children: React.ReactNode;
  status?: React.ReactNode;
}) {
  return (
    <div className="bg-black min-h-screen py-3 px-2 sm:py-4 sm:px-3 lg:py-8 lg:px-8">
      <div className="w-full max-w-[375px] sm:max-w-6xl mx-auto">
        {/* Header row - logo and view switcher */}
        <div className="flex items-end justify-between lg:justify-start gap-1.5 sm:gap-2 lg:gap-4 mb-3 sm:mb-4 lg:mb-6 max-[350px]:flex-col max-[350px]:items-start">
          <div className="flex h-8 lg:h-10 shrink-0 items-center">
            <LeagueLogo />
          </div>
          <ViewSwitcher />
          {status}
        </div>
        {children}
      </div>
    </div>
  );
}
