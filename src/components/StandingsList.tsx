import { useMemo } from 'react';
import clsx from 'clsx';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import type { TeamWithGap } from '../types/TeamWithGap';

export default function StandingsList() {
  const standings = useStandingsStore((state) => state.standings);
  const year = useStandingsStore((state) => state.year);
  const live = useStandingsStore((state) => state.live);

  const { teamsWithGap, steakLineTeam, selfBuyerSpot } = useMemo(() => {
    const managers = getManagers();

    const steakTeams = managers
      .filter((t) => t.teams[year] && 'steak' in t.teams[year])
      .map((t) => {
        const teamYear = t.teams[year];
        const league = teamYear.league || '';
        const teamID = teamYear.teamID || '';
        const division = teamYear.division || '';
        const id = `${league.toLowerCase()}${teamID}`;
        const teamStanding = standings[id] || {
          points: 0,
          wins: 0,
          losses: 0,
          ties: 0,
        };
        return {
          id,
          name: t.name,
          league,
          division,
          teamID,
          points: teamStanding.points,
          wins: teamStanding.wins,
          losses: teamStanding.losses,
          ties: teamStanding.ties,
          record: `${teamStanding.wins}-${teamStanding.losses}-${teamStanding.ties}`,
          teams: t.teams,
        };
      })
      .sort((a, b) => {
        if (a.points === b.points) {
          return a.name.localeCompare(b.name);
        }
        return b.points - a.points;
      });

    const teams = [...steakTeams];

    // Calculate the number of teams that get a steak
    const numTeamsGettingASteak = Math.floor(teams.length / 2);

    // Is there a self-buyer spot
    const selfBuyer = teams.length % 2 !== 0;

    const steakLine = selfBuyer
      ? numTeamsGettingASteak
      : numTeamsGettingASteak - 1;

    // Calculate the points scored by the team at the steak line
    const steakLinePts = teams[steakLine]?.points || 0;

    // Add the distance from the steak line
    const withGap: TeamWithGap[] = teams.map((t) => {
      const gap = Math.round((t.points - steakLinePts) * 10) / 10;
      const gapOperator = gap > 0 ? '+' : '';
      const pointsPieces = t.points.toString().split('.');
      const gapPieces = gap.toFixed(2).toString().split('.');
      return {
        ...t,
        gap: Number(gap) === 0 ? 0 : gap.toFixed(2),
        gapOperator,
        pointsInt: pointsPieces[0],
        pointsDec: pointsPieces[1],
        gapInt: gapPieces[0],
        gapDec: gapPieces[1],
      };
    });

    return {
      teamsWithGap: withGap,
      steakLineTeam: steakLine,
      selfBuyerSpot: selfBuyer,
    };
  }, [standings, year]);

  return (
    <ul className="w-full antialiased">
      {teamsWithGap.map((team, index) => (
        <li
          key={team.id}
          className={clsx(
            'px-4 py-1 lg:py-2 w-full bg-slate-800 text-slate-300 font-light text-base lg:text-xl flex justify-between shadow-2xl items-center',
            {
              'rounded-t-md': index === 0 || index === steakLineTeam + 1,
              'rounded-b-md': index === teamsWithGap.length - 1,
              'mb-0': index !== steakLineTeam,
              'mt-4 mb-4 lg:mt-6 lg:mb-6 rounded-md':
                index === steakLineTeam && selfBuyerSpot,
              'mb-4 lg:mb-6 rounded-b-md':
                index === steakLineTeam && !selfBuyerSpot,
            },
          )}
        >
          <div className="flex items-center">
            <div className="w-5">{index + 1}</div>
            <div
              className={clsx('ml-2', {
                'cursor-pointer': team.name.includes('Kurt'),
              })}
            >
              {team.name}
              {!live && (
                <span className="text-slate-400 ml-2 text-xs lg:text-sm">
                  {team.record}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center font-numerals tracking-tight">
            <div className="text-base lg:text-lg">
              <span>
                {Number(team.pointsInt).toLocaleString('en-US')}
                <span className="text-slate-400 text-[11px] lg:text-xs relative left-[1px]">
                  .{team.pointsDec}
                </span>
              </span>
            </div>
            <div
              className={clsx(
                'w-12 lg:w-14 text-right ml-3 text-sm lg:text-base font-bold',
                {
                  'text-green-500': Number(team.gap) > 0,
                  'text-gray-500': Number(team.gap) === 0,
                  'text-red-500': Number(team.gap) < 0,
                },
              )}
            >
              {team.gap === 0 ? (
                <span>&ndash;</span>
              ) : (
                <>
                  <span>{team.gapOperator + team.gapInt}</span>
                  <span className="text-[11px] lg:text-xs left-[1px] relative font-normal">
                    .{team.gapDec}
                  </span>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
