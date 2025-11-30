import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import getPlayoffSlots from '../utils/get-playoff-slots';
import PlayoffList from './PlayoffList';
import type { TeamForPlayoff } from '../types/TeamForPlayoff';

type League = 'madison' | 'la';

export default function PlayoffLists() {
  const standings = useStandingsStore((state) => state.standings);
  const year = useStandingsStore((state) => state.year);

  const { playoffsMadison, playoffsLA, bubbleMadison, bubbleLA } =
    useMemo(() => {
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

      const madisonTeams = managersWithPts.filter(
        (t) => t.league === 'Madison',
      );
      const laTeams = managersWithPts.filter((t) => t.league === 'LA');

      const madisonResult = getPlayoffSlots({
        leagueData: madisonTeams,
        divisionName1: 'Au Poivre',
        divisionName2: 'Filet Mignon',
      });

      const laResult = getPlayoffSlots({
        leagueData: laTeams,
        divisionName1: 'Taylors',
        divisionName2: 'Tornado Room',
      });

      const madisonSlots = Object.entries(madisonResult.slots) as [
        string,
        string,
      ][];
      const laSlots = Object.entries(laResult.slots) as [string, string][];

      return {
        playoffsMadison: madisonSlots,
        playoffsLA: laSlots,
        bubbleMadison: madisonResult.bubbleTeams,
        bubbleLA: laResult.bubbleTeams,
      };
    }, [standings, year]);

  const [activeLeague, setActiveLeague] = useState<League>('madison');

  return (
    <div className="rounded-lg overflow-hidden border border-gray-800/60">
      <div className="flex border-b border-gray-800/60">
        <button
          onClick={() => setActiveLeague('madison')}
          className={clsx(
            'flex-1 py-2 px-3 text-sm font-medium transition-colors',
            activeLeague === 'madison'
              ? 'text-blue-400/80 bg-blue-950/20'
              : 'text-gray-500 hover:text-gray-400',
          )}
        >
          Madison
        </button>
        <button
          onClick={() => setActiveLeague('la')}
          className={clsx(
            'flex-1 py-2 px-3 text-sm font-medium transition-colors',
            activeLeague === 'la'
              ? 'text-blue-400/80 bg-blue-950/20'
              : 'text-gray-500 hover:text-gray-400',
          )}
        >
          LA
        </button>
      </div>
      <div>
        {activeLeague === 'madison' ? (
          <PlayoffList
            playoffTeams={playoffsMadison}
            bubbleTeams={bubbleMadison}
          />
        ) : (
          <PlayoffList playoffTeams={playoffsLA} bubbleTeams={bubbleLA} />
        )}
      </div>
    </div>
  );
}
