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

  // Helper to determine which group a team belongs to
  const getTeamGroup = (index: number) => {
    if (index < steakLineTeam) return 'above';
    if (index === steakLineTeam) return 'line';
    return 'below';
  };

  return (
    <div className="w-full antialiased space-y-3 lg:space-y-4">
      {/* Teams above the line - getting steaks */}
      <ul className="rounded-xl overflow-hidden border border-navy-800/50 shadow-xl shadow-black/30">
        {teamsWithGap.filter((_, i) => getTeamGroup(i) === 'above').map((team, index) => (
          <li
            key={team.id}
            className={clsx(
              'px-4 py-2 lg:py-3 w-full bg-navy-900 text-navy-100 font-normal text-base lg:text-lg flex justify-between items-center transition-colors hover:bg-navy-800/50',
              {
                'border-b border-navy-800/50': index !== steakLineTeam - 1,
              },
            )}
          >
            <div className="flex items-center">
              <div className="w-6 text-accent-500 font-mono font-medium text-sm">{index + 1}</div>
              <div
                className={clsx('ml-2 font-medium', {
                  'cursor-pointer': team.name.includes('Kurt'),
                })}
              >
                {team.name}
                {!live && (
                  <span className="text-navy-500 ml-2 text-xs lg:text-sm font-normal">
                    {team.record}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center font-mono tracking-tight">
              <div className="text-base lg:text-lg">
                <span className="font-medium">
                  {Number(team.pointsInt).toLocaleString('en-US')}
                  <span className="text-navy-500 text-[11px] lg:text-xs relative left-[1px]">
                    .{team.pointsDec}
                  </span>
                </span>
              </div>
              <div className="w-14 lg:w-16 text-right ml-3 text-sm lg:text-base font-semibold text-emerald-400">
                <span>+{team.gapInt}</span>
                <span className="text-[11px] lg:text-xs left-[1px] relative font-normal opacity-70">
                  .{team.gapDec}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Self-buyer spot - on the line */}
      {selfBuyerSpot && teamsWithGap[steakLineTeam] && (
        <div className="rounded-xl overflow-hidden border border-accent-700/40 bg-navy-900/80">
          <div className="px-4 py-2 lg:py-3 w-full text-navy-200 font-normal text-base lg:text-lg flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-6 text-accent-400 font-mono font-medium text-sm">{steakLineTeam + 1}</div>
              <div
                className={clsx('ml-2 font-medium text-accent-200', {
                  'cursor-pointer': teamsWithGap[steakLineTeam].name.includes('Kurt'),
                })}
              >
                {teamsWithGap[steakLineTeam].name}
                {!live && (
                  <span className="text-navy-500 ml-2 text-xs lg:text-sm font-normal">
                    {teamsWithGap[steakLineTeam].record}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center font-mono tracking-tight">
              <div className="text-base lg:text-lg">
                <span className="font-medium text-accent-200">
                  {Number(teamsWithGap[steakLineTeam].pointsInt).toLocaleString('en-US')}
                  <span className="text-navy-500 text-[11px] lg:text-xs relative left-[1px]">
                    .{teamsWithGap[steakLineTeam].pointsDec}
                  </span>
                </span>
              </div>
              <div className="w-14 lg:w-16 text-right ml-3 text-sm lg:text-base font-semibold text-navy-500">
                &ndash;
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teams below the line - buying steaks */}
      <ul className="rounded-xl overflow-hidden border border-navy-800/50 shadow-xl shadow-black/30">
        {teamsWithGap.filter((_, i) => selfBuyerSpot ? i > steakLineTeam : i >= steakLineTeam).map((team, index) => {
          const actualIndex = selfBuyerSpot ? steakLineTeam + 1 + index : steakLineTeam + index;
          const isLast = actualIndex === teamsWithGap.length - 1;
          return (
            <li
              key={team.id}
              className={clsx(
                'px-4 py-2 lg:py-3 w-full bg-navy-1000 text-navy-400 font-normal text-base lg:text-lg flex justify-between items-center transition-colors hover:bg-navy-950/50',
                {
                  'border-b border-navy-900/50': !isLast,
                },
              )}
            >
              <div className="flex items-center">
                <div className="w-6 text-navy-600 font-mono font-medium text-sm">{actualIndex + 1}</div>
                <div
                  className={clsx('ml-2 font-medium', {
                    'cursor-pointer': team.name.includes('Kurt'),
                  })}
                >
                  {team.name}
                  {!live && (
                    <span className="text-navy-700 ml-2 text-xs lg:text-sm font-normal">
                      {team.record}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center font-mono tracking-tight">
                <div className="text-base lg:text-lg">
                  <span className="font-medium">
                    {Number(team.pointsInt).toLocaleString('en-US')}
                    <span className="text-navy-700 text-[11px] lg:text-xs relative left-[1px]">
                      .{team.pointsDec}
                    </span>
                  </span>
                </div>
                <div className="w-14 lg:w-16 text-right ml-3 text-sm lg:text-base font-semibold text-rose-400/70">
                  <span>{team.gapInt}</span>
                  <span className="text-[11px] lg:text-xs left-[1px] relative font-normal opacity-70">
                    .{team.gapDec}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
