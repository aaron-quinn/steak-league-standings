import clsx from 'clsx';
import TeamMatchup, { PlayerInfo } from '@/types/TeamMatchup';
import { useMemo } from 'react';
import CurrentMatchupPlayer from './CurrentMatchupPlayer';
import SectionLabel from './SectionLabel';
import { splitScore } from '@/utils/format-score';

// Position sort order: QB, RB, WR, TE, K/PK, then IDPs
const POSITION_ORDER: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  PK: 5,
  K: 5,
  TMPK: 5,
  // IDPs
  DT: 10,
  DE: 11,
  LB: 12,
  CB: 13,
  S: 14,
  DB: 15,
  // Team defense
  Def: 20,
  DEF: 20,
};

function getPositionOrder(position: string): number {
  return POSITION_ORDER[position] ?? 99;
}

function playersFor(team: TeamMatchup | null, starters: boolean) {
  if (!team) return [];
  return team.players
    .filter(
      (player) =>
        player.isStarter === starters && player.gameStatus !== 'unknown',
    )
    .map(
      (player): PlayerInfo => ({
        ...player,
        inProgress: player.gameStatus === 'in-progress',
        isCompleted: player.gameStatus === 'completed',
      }),
    )
    .sort(
      (a, b) => getPositionOrder(a.position) - getPositionOrder(b.position),
    );
}

interface TeamHeaderProps {
  team: TeamMatchup;
  name: string;
  leading: boolean;
  isTeam2?: boolean;
}

function TeamHeader({ team, name, leading, isTeam2 }: TeamHeaderProps) {
  const { int, dec } = splitScore(team.score);
  const final = team.inProgress === 0 && team.yetToPlay === 0;

  // Stacked on phones so long names get the full width
  return (
    <div
      className={clsx(
        'flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        isTeam2 && 'items-end text-right sm:flex-row-reverse',
      )}
    >
      <div className="w-full min-w-0 sm:w-auto">
        <div
          className={clsx(
            'truncate text-sm sm:text-lg lg:text-xl font-semibold',
            leading ? 'text-gray-100' : 'text-gray-400',
          )}
        >
          {name}
        </div>
        <div className="mt-0.5 text-[10px] sm:text-xs text-gray-500 tabular-nums">
          {final ? (
            'Final'
          ) : (
            <>
              {team.inProgress > 0 && (
                <span className="text-emerald-400/90">
                  {team.inProgress} live
                </span>
              )}
              {team.inProgress > 0 && team.yetToPlay > 0 && ' · '}
              {team.yetToPlay > 0 && <>{team.yetToPlay} to play</>}
            </>
          )}
        </div>
      </div>
      <div
        className={clsx(
          'shrink-0 font-mono tabular-nums text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight',
          leading ? 'text-gray-100' : 'text-gray-500',
        )}
      >
        {int}
        <span className="text-[0.6em] opacity-50">.{dec}</span>
      </div>
    </div>
  );
}

function PlayerList({
  players,
  isTeam2,
}: {
  players: PlayerInfo[];
  isTeam2?: boolean;
}) {
  if (players.length === 0) {
    return (
      <p
        className={clsx(
          'px-3 py-2 text-[10px] sm:text-xs text-gray-600',
          isTeam2 && 'text-right',
        )}
      >
        No players
      </p>
    );
  }

  return (
    <ul className="rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40 overflow-hidden">
      {players.map((player) => (
        <CurrentMatchupPlayer
          key={player.mflPlayerID ?? player.name}
          player={player}
          isTeam2={isTeam2}
        />
      ))}
    </ul>
  );
}

export interface CurrentMatchupProps {
  matchup: TeamMatchup[];
  managersMap: Map<string, { id: string; name: string; teamID: string }>;
}

function CurrentMatchup({ matchup, managersMap }: CurrentMatchupProps) {
  const team1 = matchup[0] ?? null;
  const team2 = matchup[1] ?? null;

  const manager1 = team1 ? managersMap.get(team1.franchiseID) : null;
  const manager2 = team2 ? managersMap.get(team2.franchiseID) : null;

  const team1Starters = useMemo(() => playersFor(team1, true), [team1]);
  const team1Bench = useMemo(() => playersFor(team1, false), [team1]);
  const team2Starters = useMemo(() => playersFor(team2, true), [team2]);
  const team2Bench = useMemo(() => playersFor(team2, false), [team2]);

  if (!team1) return null;

  const score1 = Number(team1.score) || 0;
  const score2 = team2 ? Number(team2.score) || 0 : 0;

  const hasBench = team1Bench.length > 0 || team2Bench.length > 0;

  return (
    <section
      aria-label={
        team2
          ? `${manager1?.name ?? 'Unknown'} vs ${manager2?.name ?? 'Unknown'}`
          : manager1?.name
      }
      className={clsx(!team2 && 'sm:max-w-[50%]')}
    >
      {/* Scoreboard */}
      <div className="rounded-lg border border-gray-800/60 bg-gray-950/30 px-3 py-3 sm:px-5 sm:py-5 mb-4 lg:mb-6">
        <div className="flex items-center gap-3 sm:gap-8">
          <TeamHeader
            team={team1}
            name={manager1?.name ?? 'Unknown Manager'}
            leading={!team2 || score1 > score2}
          />
          {team2 && (
            <>
              <div
                aria-hidden="true"
                className="w-px shrink-0 self-stretch bg-gray-800"
              />
              <TeamHeader
                team={team2}
                name={manager2?.name ?? 'Unknown Manager'}
                leading={score2 > score1}
                isTeam2
              />
            </>
          )}
        </div>
      </div>

      <SectionLabel>Starters</SectionLabel>
      <div
        className={clsx(
          'grid gap-2 sm:gap-4 lg:gap-6',
          team2 ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        <PlayerList players={team1Starters} />
        {team2 && <PlayerList players={team2Starters} isTeam2 />}
      </div>

      {hasBench && (
        <div className="mt-4 lg:mt-6 opacity-75">
          <SectionLabel>Bench</SectionLabel>
          <div
            className={clsx(
              'grid gap-2 sm:gap-4 lg:gap-6 items-start',
              team2 ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            <PlayerList players={team1Bench} />
            {team2 && <PlayerList players={team2Bench} isTeam2 />}
          </div>
        </div>
      )}
    </section>
  );
}

export default CurrentMatchup;
