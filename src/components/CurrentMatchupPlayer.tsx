import clsx from 'clsx';
import { PlayerInfo } from '@/types/TeamMatchup';
import { getNflQuarterAndTime } from '@/utils/calculate-game-clock';
import { splitScore } from '@/utils/format-score';

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
  const kickedOff = Boolean(kickoffUTC && kickoffUTC < Date.now() / 1000);
  const score = splitScore(player.score);

  const state = gameInfo.inRedZone
    ? 'red-zone'
    : gameInfo.hasPossession
      ? 'possession'
      : player.inProgress
        ? 'live'
        : null;

  let status: React.ReactNode = '—';
  if (player.isCompleted) {
    status = `Final ${opponentDisplay}`;
  } else if (kickoffUTC && kickedOff && gameSecondsRemaining > 0) {
    status =
      gameSecondsRemaining == 1800 ? (
        <>Half {opponentDisplay}</>
      ) : (
        <>
          {quarterTime} {quarter} {opponentDisplay}
          {gameInfo.shortDownText && (
            <span className="max-md:hidden">, {gameInfo.shortDownText}</span>
          )}
        </>
      );
  } else if (kickoffUTC) {
    status = `${new Date(kickoffUTC * 1000).toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })} ${opponentDisplay}`;
  }

  const shortName =
    player.firstName && player.lastName
      ? `${player.firstName[0]}. ${player.lastName}`
      : player.name;

  return (
    <li
      className={clsx(
        'relative flex items-center gap-2 sm:gap-3 px-2 py-1.5 sm:px-3 sm:py-2 transition-colors',
        isTeam2 && 'flex-row-reverse text-right',
        state === 'red-zone' && 'bg-red-500/10',
        state === 'possession' && 'bg-amber-400/[0.07]',
        state === 'live' && 'bg-emerald-500/[0.07]',
      )}
    >
      {state && (
        <span
          aria-hidden="true"
          className={clsx(
            'absolute inset-y-0 w-0.5',
            isTeam2 ? 'right-0' : 'left-0',
            state === 'red-zone' && 'bg-red-500/80',
            state === 'possession' && 'bg-amber-400/80',
            state === 'live' && 'bg-emerald-400/60',
          )}
        />
      )}
      <span className="hidden sm:block w-7 shrink-0 font-mono text-[10px] uppercase text-gray-500">
        {player.position}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={clsx(
            'flex items-baseline gap-1 text-[11px] sm:text-sm font-medium text-gray-200',
            isTeam2 && 'flex-row-reverse',
          )}
        >
          <span className="truncate">
            <span className="md:hidden">{shortName}</span>
            <span className="max-md:hidden">{player.name}</span>
          </span>
          <span className="shrink-0 text-[9px] sm:text-[11px] font-normal text-gray-600">
            <span className="sm:hidden">{player.position} </span>
            {player.team}
          </span>
        </div>
        <div
          className={clsx(
            'truncate text-[10px] sm:text-xs tabular-nums',
            state === 'red-zone'
              ? 'text-red-400/90'
              : state === 'possession'
                ? 'text-amber-300/90'
                : state === 'live'
                  ? 'text-emerald-300/80'
                  : 'text-gray-500',
          )}
        >
          {status}
          {state === 'red-zone' && <span className="sr-only"> (red zone)</span>}
          {state === 'possession' && (
            <span className="sr-only"> (has possession)</span>
          )}
        </div>
      </div>
      <span
        className={clsx(
          'shrink-0 font-mono tabular-nums text-xs sm:text-base font-semibold',
          !kickedOff
            ? 'text-gray-700'
            : player.inProgress
              ? 'text-gray-100'
              : 'text-gray-300',
        )}
      >
        {kickedOff ? (
          <>
            {score.int}
            <span className="text-[0.8em] opacity-60">.{score.dec}</span>
          </>
        ) : (
          '—'
        )}
      </span>
    </li>
  );
}

export default CurrentMatchupPlayer;
