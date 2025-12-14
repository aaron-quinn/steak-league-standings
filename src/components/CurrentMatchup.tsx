import TeamMatchup, { PlayerInfo } from '@/types/TeamMatchup';
import { getNflQuarterAndTime } from '@/utils/calculate-game-clock';
import { useMemo } from 'react';

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

export interface CurrentMatchupProps {
  matchup: TeamMatchup[];
  managersMap: Map<string, { id: string; name: string; teamID: string }>;
}

function CurrentMatchup({ matchup, managersMap }: CurrentMatchupProps) {
  const team1 = matchup[0] ?? null;
  const team2 = matchup[1] ?? null;

  const manager1 = team1 ? managersMap.get(team1.franchiseID) : null;
  const manager2 = team2 ? managersMap.get(team2.franchiseID) : null;

  const team1Starters = useMemo(() => {
    let starters: PlayerInfo[] = [];

    if (!team1) return [];

    team1.players
      .filter((player) => player.isStarter)
      .forEach((player) => {
        if (player.gameStatus === 'yet-to-play') {
          starters.push({ ...player, inProgress: false, isCompleted: false });
        } else if (player.gameStatus === 'in-progress') {
          starters.push({ ...player, inProgress: true, isCompleted: false });
        } else if (player.gameStatus === 'completed') {
          starters.push({ ...player, inProgress: false, isCompleted: true });
        }
      });

    return starters.sort((a, b) => {
      return getPositionOrder(a.position) - getPositionOrder(b.position);
    });
  }, [team1]);

  const team1Bench = useMemo(() => {
    let benched: PlayerInfo[] = [];

    if (!team1) return [];

    team1.players
      .filter((player) => !player.isStarter)
      .forEach((player) => {
        if (player.gameStatus === 'yet-to-play') {
          benched.push({ ...player, inProgress: false, isCompleted: false });
        } else if (player.gameStatus === 'in-progress') {
          benched.push({ ...player, inProgress: true, isCompleted: false });
        } else if (player.gameStatus === 'completed') {
          benched.push({ ...player, inProgress: false, isCompleted: true });
        }
      });
    return benched.sort((a, b) => {
      return getPositionOrder(a.position) - getPositionOrder(b.position);
    });
  }, [team1]);

  const team2Starters = useMemo(() => {
    let starters: PlayerInfo[] = [];

    if (!team2) return [];

    team2.players
      .filter((player) => player.isStarter)
      .forEach((player) => {
        if (player.gameStatus === 'yet-to-play') {
          starters.push({ ...player, inProgress: false, isCompleted: false });
        } else if (player.gameStatus === 'in-progress') {
          starters.push({ ...player, inProgress: true, isCompleted: false });
        } else if (player.gameStatus === 'completed') {
          starters.push({ ...player, inProgress: false, isCompleted: true });
        }
      });

    return starters.sort((a, b) => {
      return getPositionOrder(a.position) - getPositionOrder(b.position);
    });
  }, [team2]);

  const team2Bench = useMemo(() => {
    let benched: PlayerInfo[] = [];

    if (!team2) return [];

    team2.players
      .filter((player) => !player.isStarter)
      .forEach((player) => {
        if (player.gameStatus === 'yet-to-play') {
          benched.push({ ...player, inProgress: false, isCompleted: false });
        } else if (player.gameStatus === 'in-progress') {
          benched.push({ ...player, inProgress: true, isCompleted: false });
        } else if (player.gameStatus === 'completed') {
          benched.push({ ...player, inProgress: false, isCompleted: true });
        }
      });
    return benched.sort((a, b) => {
      return getPositionOrder(a.position) - getPositionOrder(b.position);
    });
  }, [team2]);

  return (
    <div style={{ maxWidth: !team2 ? '50%' : undefined }}>
      <div className="flex flex-row justify-between px-3 mb-4 gap-4 lg:gap-6">
        <div className="flex flex-1 flex-row justify-between items-center">
          <div className="flex flex-col">
            <div className="text-xs sm:text-sm md:text-lg font-semibold">
              {manager1 ? manager1.name : 'Unknown Manager'}
            </div>
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-400">
              In Progress: {team1 ? team1.inProgress : 'N/A'}
            </div>
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-400">
              Yet to play: {team1 ? team1.yetToPlay : 'N/A'}
            </div>
          </div>
          <div className="text-sm sm:text-lg md:text-2xl font-bold">
            {team1 ? Number(team1.score).toFixed(1) : '-'}
          </div>
        </div>
        {team2 && (
          <div className="flex flex-1 flex-row justify-between items-center text-right">
            <div className="text-sm sm:text-lg md:text-2xl font-bold">
              {team2 ? Number(team2.score).toFixed(1) : '-'}
            </div>
            <div className="flex flex-col">
              <div className="text-xs sm:text-sm md:text-lg font-semibold">
                {manager2 ? manager2.name : 'Unknown Manager'}
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                In Progress: {team2 ? team2.inProgress : 'N/A'}
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                Yet to play: {team2 ? team2.yetToPlay : 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-4 lg:gap-6">
        <div style={{ flex: 1 }}>
          <ul
            style={{ listStyle: 'none', padding: 0 }}
            className="flex flex-col gap-2"
          >
            {team1Starters.map((player) => {
              const gameInfo = player.gameInfo || {};
              const kickoffUTC = gameInfo.kickoff || null;
              const gameSecondsRemaining = gameInfo.gameSecondsRemaining || 0;
              const { quarter, quarterTime } =
                getNflQuarterAndTime(gameSecondsRemaining);
              const opponentDisplay = gameInfo.opponentDisplay || '';
              return (
                <li
                  key={player.name}
                  className={`flex flex-row items-center justify-between py-2 px-3 rounded-lg bg-gray-900/80 ${
                    player.inProgress ? 'bg-blue-400/20' : ''
                  }`}
                  // ${
                  //   player.gameInfo?.inRedZone
                  //     ? 'bg-red-600/20 border-red-800/80'
                  //     : player.gameInfo?.hasPossession
                  //       ? 'bg-blue-600/20 border-blue-400/40'
                  //       : player.inProgress
                  //         ? 'bg-blue-400/20 border-blue-400/20'
                  //         : 'border-gray-900/80'
                  // }
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-row items-end leading-none sm:leading-[28px] gap-x-1 text-[10px] sm:text-sm font-semibold">
                      <span className="block md:hidden">
                        {player.firstName && player.lastName
                          ? `${player.firstName[0]}. ${player.lastName}`
                          : player.name}
                      </span>
                      <span className="hidden md:inline">{player.name}</span>{' '}
                      <span className="text-[8px] sm:text-[10px] font-normal">
                        {player.team} {player.position}
                      </span>
                    </div>
                    {player.isCompleted ? (
                      <div className="text-[10px] sm:text-xs text-gray-400">
                        Final
                      </div>
                    ) : (
                      kickoffUTC && (
                        <div className="text-[10px] sm:text-xs text-gray-400">
                          {kickoffUTC < Date.now() / 1000 &&
                          gameSecondsRemaining > 0 ? (
                            <>
                              {quarterTime} {quarter} {opponentDisplay}
                            </>
                          ) : (
                            <>
                              {new Date(kickoffUTC * 1000).toLocaleString(
                                'en-US',
                                {
                                  weekday: 'short',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                },
                              )}{' '}
                              {opponentDisplay}
                            </>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  <div className="text-xs sm:text-base font-bold">
                    {kickoffUTC && kickoffUTC < Date.now() / 1000
                      ? player.score
                      : '-'}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-row justify-between items-center font-bold my-3 px-3">
            <span className=""></span>
            <span>{team1 ? (Number(team1.score).toFixed(1) ?? '-') : '-'}</span>
          </div>
          <ul
            style={{ listStyle: 'none', padding: 0 }}
            className="flex flex-col gap-2"
          >
            {team1Bench.map((player) => {
              const gameInfo = player.gameInfo || {};
              const kickoffUTC = gameInfo.kickoff || null;
              const gameSecondsRemaining = gameInfo.gameSecondsRemaining || 0;
              const { quarter, quarterTime } =
                getNflQuarterAndTime(gameSecondsRemaining);
              const opponentDisplay = gameInfo.opponentDisplay || '';
              return (
                <li
                  key={player.name}
                  className={`flex flex-row items-center justify-between py-2 px-3 rounded-lg bg-gray-900/80 ${
                    player.inProgress ? 'bg-blue-400/20' : ''
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-row items-end leading-none sm:leading-[28px] gap-x-1 text-[10px] sm:text-sm font-semibold">
                      <span className="block md:hidden">
                        {player.firstName && player.lastName
                          ? `${player.firstName[0]}. ${player.lastName}`
                          : player.name}
                      </span>
                      <span className="hidden md:inline">{player.name}</span>{' '}
                      <span className="text-[8px] sm:text-[10px] font-normal">
                        {player.team} {player.position}
                      </span>
                    </div>
                    {player.isCompleted ? (
                      <div className="text-[10px] sm:text-xs text-gray-400">
                        Final
                      </div>
                    ) : (
                      kickoffUTC && (
                        <div className="text-[10px] sm:text-xs text-gray-400">
                          {kickoffUTC < Date.now() / 1000 &&
                          gameSecondsRemaining > 0 ? (
                            <>
                              {quarterTime} {quarter} {opponentDisplay}
                            </>
                          ) : (
                            <>
                              {new Date(kickoffUTC * 1000).toLocaleString(
                                'en-US',
                                {
                                  weekday: 'short',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                },
                              )}{' '}
                              {opponentDisplay}
                            </>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  <div className="text-xs sm:text-base font-bold">
                    {kickoffUTC && kickoffUTC < Date.now() / 1000
                      ? player.score
                      : '-'}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {team2 && (
          <div style={{ flex: 1 }}>
            <ul
              style={{ listStyle: 'none', padding: 0 }}
              className="flex flex-col gap-2"
            >
              {team2Starters.map((player) => {
                const gameInfo = player.gameInfo || {};
                const kickoffUTC = gameInfo.kickoff || null;
                const gameSecondsRemaining = gameInfo.gameSecondsRemaining || 0;
                const { quarter, quarterTime } =
                  getNflQuarterAndTime(gameSecondsRemaining);
                const opponentDisplay = gameInfo.opponentDisplay || '';
                return (
                  <li
                    key={player.name}
                    className={`flex flex-row items-center justify-between py-2 px-3 rounded-lg bg-gray-900/80 ${
                      player.inProgress ? 'bg-blue-400/20' : ''
                    }`}
                  >
                    <div className="text-xs sm:text-base font-bold">
                      {kickoffUTC && kickoffUTC < Date.now() / 1000
                        ? player.score
                        : '-'}
                    </div>
                    <div className="flex flex-col gap-1 items-end text-right">
                      <div className="flex flex-row items-end leading-none sm:leading-[28px] gap-x-1 text-[10px] sm:text-sm font-semibold">
                        <span className="block md:hidden">
                          {player.firstName && player.lastName
                            ? `${player.firstName[0]}. ${player.lastName}`
                            : player.name}
                        </span>
                        <span className="hidden md:inline">{player.name}</span>{' '}
                        <span className="text-[8px] sm:text-[10px] font-normal">
                          {player.team} {player.position}
                        </span>
                      </div>
                      {player.isCompleted ? (
                        <div className="text-[10px] sm:text-xs text-gray-400">
                          Final
                        </div>
                      ) : (
                        kickoffUTC && (
                          <div className="text-[10px] sm:text-xs text-gray-400">
                            {kickoffUTC < Date.now() / 1000 &&
                            gameSecondsRemaining > 0 ? (
                              <>
                                {quarterTime} {quarter} {opponentDisplay}
                              </>
                            ) : (
                              <>
                                {new Date(kickoffUTC * 1000).toLocaleString(
                                  'en-US',
                                  {
                                    weekday: 'short',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  },
                                )}{' '}
                                {opponentDisplay}
                              </>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-row justify-between items-center font-bold my-3 px-3">
              <span>
                {team2 ? (Number(team2.score).toFixed(1) ?? '-') : '-'}
              </span>
              <span className=""></span>
            </div>
            <ul
              style={{ listStyle: 'none', padding: 0 }}
              className="flex flex-col gap-2"
            >
              {team2Bench.map((player) => {
                const gameInfo = player.gameInfo || {};
                const kickoffUTC = gameInfo.kickoff || null;
                const gameSecondsRemaining = gameInfo.gameSecondsRemaining || 0;
                const { quarter, quarterTime } =
                  getNflQuarterAndTime(gameSecondsRemaining);
                const opponentDisplay = gameInfo.opponentDisplay || '';
                return (
                  <li
                    key={player.name}
                    className={`flex flex-row items-center justify-between py-2 px-3 rounded-lg bg-gray-900/80 ${
                      player.inProgress ? 'bg-blue-400/20' : ''
                    }`}
                  >
                    <div className="text-xs sm:text-base font-bold">
                      {kickoffUTC && kickoffUTC < Date.now() / 1000
                        ? player.score
                        : '-'}
                    </div>
                    <div className="flex flex-col gap-1 items-end text-right">
                      <div className="flex flex-row items-end leading-none sm:leading-[28px] gap-x-1 text-[10px] sm:text-sm font-semibold">
                        <span className="block md:hidden">
                          {player.firstName && player.lastName
                            ? `${player.firstName[0]}. ${player.lastName}`
                            : player.name}
                        </span>
                        <span className="hidden md:inline">{player.name}</span>{' '}
                        <span className="text-[8px] sm:text-[10px] font-normal">
                          {player.team} {player.position}
                        </span>
                      </div>
                      {player.isCompleted ? (
                        <div className="text-[10px] sm:text-xs text-gray-400">
                          Final
                        </div>
                      ) : (
                        kickoffUTC && (
                          <div className="text-[10px] sm:text-xs text-gray-400">
                            {kickoffUTC < Date.now() / 1000 &&
                            gameSecondsRemaining > 0 ? (
                              <>
                                {quarterTime} {quarter} {opponentDisplay}
                              </>
                            ) : (
                              <>
                                {new Date(kickoffUTC * 1000).toLocaleString(
                                  'en-US',
                                  {
                                    weekday: 'short',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  },
                                )}{' '}
                                {opponentDisplay}
                              </>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default CurrentMatchup;
