import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useStandingsStore } from '../stores/standings';
import { getMatchups } from '@/api/matchups';
import { getStandings, getWeek } from '@/api';
import MatchupTeams from '@/components/MatchupTeams';
import { useEffect, useMemo, useState } from 'react';
import CurrentMatchup from '@/components/CurrentMatchup';
import ErrorScreen from '@/components/ErrorScreen';
import MatchupsPlaceholder from '@/components/MatchupsPlaceholder';
import MatchupsSkeleton from '@/components/MatchupsSkeleton';
import SectionLabel from '@/components/SectionLabel';
import HeaderStatus from '@/components/HeaderStatus';
import TeamMatchup from '@/types/TeamMatchup';
import { getTeamManagers, rankSteakTeams } from '@/utils/steak-teams';
import PageShell from '@/components/PageShell';

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

  // Same query as the Official view, so the cache is shared between pages
  const { data: officialStandings } = useQuery({
    queryKey: ['standings', year, false],
    queryFn: () => getStandings(`/standings/${year}`),
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
    const teams = getTeamManagers(year);
    if (!officialStandings) return teams;

    const ranks = rankSteakTeams(
      teams.values(),
      (id) => Number(officialStandings[id]?.points) || 0,
    );
    teams.forEach((team) => {
      team.rank = ranks.get(team.id);
    });
    return teams;
  }, [year, officialStandings]);

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
