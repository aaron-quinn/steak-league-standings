import { useMemo } from 'react';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import getPlayoffSlots from '../utils/get-playoff-slots';
import PlayoffList from './PlayoffList';
import type { TeamForPlayoff } from '../types/TeamForPlayoff';

export default function PlayoffLists() {
  const standings = useStandingsStore((state) => state.standings);
  const year = useStandingsStore((state) => state.year);

  const { playoffsMadison, playoffsLA } = useMemo(() => {
    const managers = getManagers();

    const managersWithPts: TeamForPlayoff[] = managers
      .filter((t) => t.teams[year])
      .map((m) => {
        const teamYear = m.teams[year];
        const league = teamYear.league || '';
        const division = teamYear.division || '';
        const teamID = teamYear.teamID || '';
        const team = `${league.toLowerCase()}${teamID}`;
        const teamStanding = standings[team] || {
          points: 0,
          wins: 0,
          losses: 0,
          ties: 0,
        };
        return {
          name: m.name,
          league,
          division,
          points: teamStanding.points,
          wins: teamStanding.wins,
          losses: teamStanding.losses,
          ties: teamStanding.ties,
        };
      });

    const madisonTeams = managersWithPts.filter((t) => t.league === 'Madison');
    const laTeams = managersWithPts.filter((t) => t.league === 'LA');

    const madisonSlots = Object.entries(
      getPlayoffSlots({
        leagueData: madisonTeams,
        divisionName1: 'Au Poivre',
        divisionName2: 'Filet Mignon',
      }),
    ) as [string, string][];

    const laSlots = Object.entries(
      getPlayoffSlots({
        leagueData: laTeams,
        divisionName1: 'Taylors',
        divisionName2: 'Tornado Room',
      }),
    ) as [string, string][];

    return {
      playoffsMadison: madisonSlots,
      playoffsLA: laSlots,
    };
  }, [standings, year]);

  return (
    <div className="flex flex-wrap w-full gap-6">
      <PlayoffList playoffTeams={playoffsMadison} league="Madison" />
      <PlayoffList playoffTeams={playoffsLA} league="LA" />
    </div>
  );
}
