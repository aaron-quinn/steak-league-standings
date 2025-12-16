import { PlayerInfo } from '@/types/TeamMatchup';
import { getNflQuarterAndTime } from '@/utils/calculate-game-clock';

interface Props {
  isTeam2?: boolean;
  player: PlayerInfo;
}

function CurrentMatchupPlayer({ isTeam2, player }: Props) {
  const gameInfo = player.gameInfo || {};
  const kickoffUTC = gameInfo.kickoff || null;
  const gameSecondsRemaining = gameInfo.gameSecondsRemaining || 0;
  const { quarter, quarterTime } = getNflQuarterAndTime(gameSecondsRemaining);
  const opponentDisplay = gameInfo.opponentDisplay || '';

  function ScoreDisplay() {
    return (
      <div className="text-xs sm:text-base font-bold">
        {kickoffUTC && kickoffUTC < Date.now() / 1000 ? player.score : '-'}
      </div>
    );
  }

  function PlayerInfo() {
    return (
      <div
        className={`flex flex-col gap-1 ${isTeam2 ? 'text-right items-end' : 'text-left'}`}
      >
        <div className="flex flex-row leading-none sm:leading-[28px] gap-x-1 text-[10px] sm:text-sm font-semibold">
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
          <div className="text-[10px] sm:text-xs text-gray-400">Final</div>
        ) : (
          kickoffUTC && (
            <div className="text-[10px] sm:text-xs text-gray-400">
              {kickoffUTC < Date.now() / 1000 && gameSecondsRemaining > 0 ? (
                gameSecondsRemaining == 1800 ? (
                  <>Half {opponentDisplay}</>
                ) : (
                  <>
                    {quarterTime} {quarter} {opponentDisplay}
                    {player.gameInfo?.shortDownText && (
                      <span className="max-md:hidden">
                        , {player.gameInfo.shortDownText}
                      </span>
                    )}
                  </>
                )
              ) : (
                <>
                  {new Date(kickoffUTC * 1000).toLocaleString('en-US', {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}{' '}
                  {opponentDisplay}
                </>
              )}
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <li
      className={`flex flex-row items-center justify-between py-2 px-3 rounded-lg border-2
                ${
                  player.gameInfo?.inRedZone
                    ? 'bg-red-600/20 border-red-800/80'
                    : player.gameInfo?.hasPossession
                      ? 'bg-yellow-600/20 border-yellow-400'
                      : player.inProgress
                        ? 'bg-blue-400/20 border-blue-400/20'
                        : 'bg-gray-900/80 border-gray-900/80'
                }`}
    >
      {isTeam2 ? (
        <>
          <ScoreDisplay />
          <PlayerInfo />
        </>
      ) : (
        <>
          <PlayerInfo />
          <ScoreDisplay />
        </>
      )}
    </li>
  );
}

export default CurrentMatchupPlayer;
