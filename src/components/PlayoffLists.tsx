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
    <div>
      <div className="flex bg-slate-700 rounded-t-md">
        <button
          onClick={() => setActiveLeague('madison')}
          className={clsx(
            'flex-1 py-2 px-3 text-sm font-bold rounded-tl-md transition-colors',
            activeLeague === 'madison'
              ? 'bg-slate-600 text-slate-200'
              : 'text-slate-400 hover:text-slate-300',
          )}
        >
          Madison
        </button>
        <button
          onClick={() => setActiveLeague('la')}
          className={clsx(
            'flex-1 py-2 px-3 text-sm font-bold rounded-tr-md transition-colors',
            activeLeague === 'la'
              ? 'bg-slate-600 text-slate-200'
              : 'text-slate-400 hover:text-slate-300',
          )}
        >
          LA
        </button>
      </div>
      <div className="bg-slate-800 rounded-b-md">
        {activeLeague === 'madison' ? (
          <PlayoffList playoffTeams={playoffsMadison} />
        ) : (
          <PlayoffList playoffTeams={playoffsLA} />
        )}
      </div>
    </div>
  );
}
