import { useState, useMemo } from 'react';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import getPlayoffSlots from '../utils/get-playoff-slots';
import PlayoffList from './PlayoffList';
import SectionLabel from './SectionLabel';
import SegmentedTabs from './SegmentedTabs';
import type { TeamForPlayoff } from '../types/TeamForPlayoff';

type League = 'madison' | 'la';

export default function PlayoffLists() {
  const standings = useStandingsStore((state) => state.standings);
  const year = useStandingsStore((state) => state.year);
  const live = useStandingsStore((state) => state.live);

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
    <section aria-label="Playoff picture">
      <SectionLabel>Playoff Picture</SectionLabel>
      <div className="rounded-lg border border-gray-800/60 bg-gray-950/30">
        <div className="p-1.5 sm:p-2 border-b border-gray-800/60">
          <SegmentedTabs
            label="League"
            tabs={[
              { value: 'madison', label: 'Madison' },
              { value: 'la', label: 'LA' },
            ]}
            value={activeLeague}
            onChange={setActiveLeague}
          />
          {live && (
            <p className="mt-1.5 sm:mt-2 px-1 text-[10px] sm:text-xs text-gray-500 leading-snug text-pretty text-center">
              Assumes whoever is winning their matchup right now banks the win.
            </p>
          )}
        </div>
        {activeLeague === 'madison' ? (
          <PlayoffList
            playoffTeams={playoffsMadison}
            bubbleTeams={live ? [] : bubbleMadison}
          />
        ) : (
          <PlayoffList
            playoffTeams={playoffsLA}
            bubbleTeams={live ? [] : bubbleLA}
          />
        )}
      </div>
    </section>
  );
}
