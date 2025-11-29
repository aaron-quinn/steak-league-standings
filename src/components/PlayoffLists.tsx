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

  const [activeLeague, setActiveLeague] = useState<League>('madison');

  return (
    <div className="rounded-xl overflow-hidden border border-navy-800/50 shadow-xl shadow-black/30">
      <div className="flex bg-navy-900">
        <button
          onClick={() => setActiveLeague('madison')}
          className={clsx(
            'flex-1 py-2.5 px-3 text-sm font-semibold transition-all duration-200',
            activeLeague === 'madison'
              ? 'bg-navy-950 text-accent-400 border-b-2 border-accent-500'
              : 'text-navy-400 hover:text-accent-300',
          )}
        >
          Madison
        </button>
        <button
          onClick={() => setActiveLeague('la')}
          className={clsx(
            'flex-1 py-2.5 px-3 text-sm font-semibold transition-all duration-200',
            activeLeague === 'la'
              ? 'bg-navy-950 text-accent-400 border-b-2 border-accent-500'
              : 'text-navy-400 hover:text-accent-300',
          )}
        >
          LA
        </button>
      </div>
      <div className="bg-navy-950">
        {activeLeague === 'madison' ? (
          <PlayoffList playoffTeams={playoffsMadison} />
        ) : (
          <PlayoffList playoffTeams={playoffsLA} />
        )}
      </div>
    </div>
  );
}
