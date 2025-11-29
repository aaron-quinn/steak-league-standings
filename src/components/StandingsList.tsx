import { useMemo } from 'react';
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
    <div className="w-full antialiased">
      {/* Teams above the line - getting steaks */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-gradient-to-r from-emerald-600/30 to-transparent" />
          <span className="text-[10px] uppercase tracking-widest text-emerald-600/60 font-medium">
            Eaters
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-emerald-600/30 to-transparent" />
        </div>
        <div className="rounded-lg border border-gray-800/60 overflow-hidden">
          {teamsWithGap.slice(0, steakLineTeam).map((team, index) => (
            <div
              key={team.id}
              className={`
                flex items-center justify-between px-3 py-2.5 lg:py-3
                ${index % 2 === 0 ? 'bg-emerald-950/10' : 'bg-transparent'}
                ${index !== steakLineTeam - 1 ? 'border-b border-gray-800/30' : ''}
                hover:bg-emerald-950/20 transition-colors
              `}
            >
              <div className="flex items-center gap-4">
                <span className="w-6 h-6 rounded-full bg-emerald-900/30 text-emerald-500/80 font-mono text-xs flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm lg:text-base text-gray-300 font-medium min-w-[120px] lg:min-w-[160px]">
                  {team.name}
                </span>
              </div>
              <div className="flex items-center gap-3 lg:gap-6 font-mono">
                {!live && (
                  <span className="text-gray-600 text-xs tabular-nums w-14 lg:w-16 text-center">
                    {team.record}
                  </span>
                )}
                <span className="text-xs lg:text-sm tabular-nums text-gray-400 w-16 lg:w-20 text-right">
                  {Number(team.pointsInt).toLocaleString('en-US')}
                  <span className="text-[0.75em] text-gray-600">
                    .{team.pointsDec}
                  </span>
                </span>
                <span className="w-20 lg:w-24 text-right text-sm lg:text-base tabular-nums text-emerald-500/90 font-semibold">
                  +{team.gapInt}
                  <span className="text-[0.75em] text-emerald-500/50">
                    .{team.gapDec}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Self-buyer spot - on the line */}
      {selfBuyerSpot && teamsWithGap[steakLineTeam] && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 to-transparent" />
            <span className="text-[10px] uppercase tracking-widest text-blue-400/60 font-medium">
              Self Buyer
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-blue-500/30 to-transparent" />
          </div>
          <div className="rounded-lg border border-blue-800/30 bg-blue-950/10 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 lg:py-3">
              <div className="flex items-center gap-4">
                <span className="w-6 h-6 rounded-full bg-blue-900/30 text-blue-400/80 font-mono text-xs flex items-center justify-center border border-blue-700/30">
                  {steakLineTeam + 1}
                </span>
                <span className="text-sm lg:text-base text-gray-300 font-medium min-w-[120px] lg:min-w-[160px]">
                  {teamsWithGap[steakLineTeam].name}
                </span>
              </div>
              <div className="flex items-center gap-3 lg:gap-6 font-mono">
                {!live && (
                  <span className="text-gray-600 text-xs tabular-nums w-14 lg:w-16 text-center">
                    {teamsWithGap[steakLineTeam].record}
                  </span>
                )}
                <span className="text-xs lg:text-sm tabular-nums text-gray-400 w-16 lg:w-20 text-right">
                  {Number(teamsWithGap[steakLineTeam].pointsInt).toLocaleString(
                    'en-US',
                  )}
                  <span className="text-[0.75em] text-gray-600">
                    .{teamsWithGap[steakLineTeam].pointsDec}
                  </span>
                </span>
                <span className="w-20 lg:w-24 text-right text-sm lg:text-base tabular-nums text-gray-600 font-semibold">
                  —
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teams below the line - buying steaks */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-gradient-to-r from-red-500/25 to-transparent" />
          <span className="text-[10px] uppercase tracking-widest text-red-400/50 font-medium">
            Buyers
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-red-500/25 to-transparent" />
        </div>
        <div className="rounded-lg border border-gray-800/40 overflow-hidden">
          {teamsWithGap
            .slice(selfBuyerSpot ? steakLineTeam + 1 : steakLineTeam)
            .map((team, index) => {
              const actualIndex = selfBuyerSpot
                ? steakLineTeam + 1 + index
                : steakLineTeam + index;
              const isLast = actualIndex === teamsWithGap.length - 1;
              return (
                <div
                  key={team.id}
                  className={`
                    flex items-center justify-between px-3 py-2 lg:py-2.5
                    ${index % 2 === 0 ? 'bg-red-950/5' : 'bg-transparent'}
                    ${!isLast ? 'border-b border-gray-800/20' : ''}
                    hover:bg-red-950/10 transition-colors
                  `}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-6 h-6 rounded-full bg-gray-800/30 text-gray-500 font-mono text-xs flex items-center justify-center">
                      {actualIndex + 1}
                    </span>
                    <span className="text-sm lg:text-base text-gray-500 min-w-[120px] lg:min-w-[160px]">
                      {team.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 lg:gap-6 font-mono">
                    {!live && (
                      <span className="text-gray-600 text-xs tabular-nums w-14 lg:w-16 text-center">
                        {team.record}
                      </span>
                    )}
                    <span className="text-xs lg:text-sm tabular-nums text-gray-500 w-16 lg:w-20 text-right">
                      {Number(team.pointsInt).toLocaleString('en-US')}
                      <span className="text-[0.75em] text-gray-700">
                        .{team.pointsDec}
                      </span>
                    </span>
                    <span className="w-20 lg:w-24 text-right text-sm lg:text-base tabular-nums text-red-500/70 font-semibold">
                      {team.gapInt}
                      <span className="text-[0.75em] text-red-500/40">
                        .{team.gapDec}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
