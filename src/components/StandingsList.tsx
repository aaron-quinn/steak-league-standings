import { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStandingsStore } from '../stores/standings';
import getManagers from '../data/managers';
import type { TeamWithGap } from '../types/TeamWithGap';
import type { PlayerInfo } from '../types/TeamStanding';

// Position sort order: QB, RB, WR, TE, K/PK, then IDPs
const POSITION_ORDER: Record<string, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  PK: 5,
  K: 5,
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

// Normalize player data - handles both string[] (old API) and PlayerInfo[] (new API)
function normalizePlayers(
  players: (string | PlayerInfo)[] | undefined,
): PlayerInfo[] {
  if (!players) return [];
  return players.map((player) => {
    if (typeof player === 'string') {
      return { name: player, position: '' };
    }
    return player;
  });
}

function sortPlayersByPosition(players: PlayerInfo[]): PlayerInfo[] {
  return [...players].sort(
    (a, b) => getPositionOrder(a.position) - getPositionOrder(b.position),
  );
}

interface PlayerPopoverProps {
  team: TeamWithGap;
  onClose: () => void;
  anchorRect: DOMRect | null;
  variant?: 'eater' | 'buyer' | 'self-buyer';
}

const popoverVariantStyles = {
  eater: {
    count: 'text-emerald-500/90',
    label: 'text-emerald-500/80',
    position: 'text-emerald-600/70',
  },
  buyer: {
    count: 'text-red-500/90',
    label: 'text-red-500/80',
    position: 'text-red-600/70',
  },
  'self-buyer': {
    count: 'text-gray-400/90',
    label: 'text-gray-400/80',
    position: 'text-gray-500/70',
  },
};

function PlayerPopover({
  team,
  onClose,
  anchorRect,
  variant = 'eater',
}: PlayerPopoverProps) {
  const popoverStyles = popoverVariantStyles[variant];
  const normalizedInProgress = normalizePlayers(team.inProgressNames);
  const normalizedYetToPlay = normalizePlayers(team.yetToPlayNames);

  const hasYetToPlay = normalizedYetToPlay.length > 0;
  const hasInProgress = normalizedInProgress.length > 0;

  const sortedInProgress = hasInProgress
    ? sortPlayersByPosition(normalizedInProgress)
    : [];
  const sortedYetToPlay = hasYetToPlay
    ? sortPlayersByPosition(normalizedYetToPlay)
    : [];

  if (!anchorRect) return null;

  // Estimate popover height based on content
  const estimatedHeight =
    80 + // base padding, header
    (hasInProgress ? 24 + sortedInProgress.length * 20 : 0) +
    (hasYetToPlay ? 24 + sortedYetToPlay.length * 20 : 0);

  // Check if there's enough space below the anchor
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const showAbove = spaceBelow < estimatedHeight + 8 && spaceAbove > spaceBelow;

  // Position the popover above or below the anchor
  const style: React.CSSProperties = {
    position: 'fixed',
    right: window.innerWidth - anchorRect.right,
    zIndex: 50,
    ...(showAbove
      ? { bottom: window.innerHeight - anchorRect.top + 4 }
      : { top: anchorRect.bottom + 4 }),
  };

  return createPortal(
    <div
      className="min-w-[220px] rounded-lg border border-gray-700 bg-gray-900 shadow-xl"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-400">{team.name}</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        </div>

        {hasInProgress && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[10px] font-bold ${popoverStyles.count}`}>
                {sortedInProgress.length}
              </span>
              <span
                className={`text-[10px] uppercase tracking-wide ${popoverStyles.label}`}
              >
                In Progress
              </span>
            </div>
            <ul className="text-xs text-gray-300 space-y-0.5">
              {sortedInProgress.map((player, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`w-7 text-[10px] font-medium ${popoverStyles.position} uppercase`}
                  >
                    {player.position}
                  </span>
                  <span className="flex-1">{player.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasYetToPlay && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold text-gray-400">
                {sortedYetToPlay.length}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-gray-500">
                Yet to Play
              </span>
            </div>
            <ul className="text-xs text-gray-400 space-y-0.5">
              {sortedYetToPlay.map((player, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-7 text-[10px] font-medium text-gray-600 uppercase">
                    {player.position}
                  </span>
                  <span className="flex-1">{player.name}</span>
                  {player.gameTime && (
                    <span className="text-[10px] text-gray-600">
                      {player.gameTime}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasInProgress && !hasYetToPlay && (
          <p className="text-xs text-gray-500">All players completed</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface RemainingPlayersIndicatorProps {
  team: TeamWithGap;
  totalSlots?: number;
  variant?: 'eater' | 'buyer' | 'self-buyer';
}

const variantStyles = {
  eater: {
    completed: 'bg-emerald-600/50',
    inProgress: 'bg-emerald-300/70',
    background: 'bg-emerald-950/40',
    hover: 'hover:bg-emerald-900/30',
    text: 'text-emerald-500/80 group-hover:text-emerald-400 font-semibold',
  },
  buyer: {
    completed: 'bg-red-600/50',
    inProgress: 'bg-red-400/80',
    background: 'bg-red-950/40',
    hover: 'hover:bg-red-900/30',
    text: 'text-red-500/80 group-hover:text-red-400 font-semibold',
  },
  'self-buyer': {
    completed: 'bg-gray-500/50',
    inProgress: 'bg-gray-400/80',
    background: 'bg-gray-800/40',
    hover: 'hover:bg-gray-700/30',
    text: 'text-gray-400/80 group-hover:text-gray-300 font-semibold',
  },
};

function RemainingPlayersIndicator({
  team,
  totalSlots = 12,
  variant = 'eater',
}: RemainingPlayersIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const styles = variantStyles[variant];

  const yetToPlay = team.yetToPlay || 0;
  const inProgress = team.inProgress || 0;
  const remaining = yetToPlay + inProgress;
  const completed = totalSlots - remaining;

  // Update anchor position when popover opens or window scrolls/resizes
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (buttonRef.current) {
        setAnchorRect(buttonRef.current.getBoundingClientRect());
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Calculate percentages for the progress bar
  const completedPct = (completed / totalSlots) * 100;
  const inProgressPct = (inProgress / totalSlots) * 100;

  // Show "Final" when all players have completed
  if (remaining === 0) {
    const finalTextColor = {
      eater: 'text-emerald-600/70',
      buyer: 'text-red-600/70',
      'self-buyer': 'text-gray-500',
    }[variant];

    return (
      <div className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-1">
        <span
          className={`w-10 sm:w-16 lg:w-20 text-[10px] sm:text-xs ${finalTextColor} font-medium text-center`}
        >
          Final
        </span>
        <span className="w-4 sm:w-5" />
      </div>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-1 rounded transition-colors group ${styles.hover}`}
        title={`${completed} done, ${inProgress} in progress, ${yetToPlay} yet to play`}
      >
        {/* Progress bar */}
        <div
          className={`w-10 sm:w-16 lg:w-20 h-1.5 sm:h-2 rounded-full overflow-hidden flex ${styles.background}`}
        >
          {/* Completed section */}
          <div
            className={`h-full transition-all ${styles.completed}`}
            style={{ width: `${completedPct}%` }}
          />
          {/* In progress section */}
          <div
            className={`h-full animate-pulse transition-all ${styles.inProgress}`}
            style={{ width: `${inProgressPct}%` }}
          />
        </div>
        {/* Count label */}
        <span
          className={`text-[10px] sm:text-xs font-mono transition-colors w-4 sm:w-5 text-center ${styles.text}`}
        >
          {remaining}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <PlayerPopover
            team={team}
            onClose={() => setIsOpen(false)}
            anchorRect={anchorRect}
            variant={variant}
          />
        </>
      )}
    </>
  );
}

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
          // Live player data
          yetToPlay: teamStanding.yetToPlay,
          inProgress: teamStanding.inProgress,
          yetToPlayNames: teamStanding.yetToPlayNames,
          inProgressNames: teamStanding.inProgressNames,
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
        gapNum: Math.abs(gap),
      };
    });

    // Calculate max gaps for heatmap intensity
    const maxPositiveGap = Math.max(
      ...withGap.slice(0, steakLine).map((t) => t.gapNum),
      1,
    );
    const maxNegativeGap = Math.max(
      ...withGap
        .slice(selfBuyer ? steakLine + 1 : steakLine)
        .map((t) => t.gapNum),
      1,
    );

    return {
      teamsWithGap: withGap,
      steakLineTeam: steakLine,
      selfBuyerSpot: selfBuyer,
      maxPositiveGap,
      maxNegativeGap,
    };
  }, [standings, year]);

  return (
    <div className="w-full antialiased">
      {/* Teams above the line - getting steaks */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-gradient-to-r from-emerald-600/35 to-transparent" />
          <span className="text-[10px] uppercase tracking-widest text-emerald-600/65 font-medium">
            Eaters
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-emerald-600/35 to-transparent" />
        </div>
        <div className="rounded-lg border border-gray-800/50 overflow-hidden">
          {teamsWithGap.slice(0, steakLineTeam).map((team, index) => {
            const cappedGap = Math.min(team.gapNum, 130);
            const intensity = Math.round((cappedGap / 130) * 45) + 5;
            return (
              <div
                key={team.id}
                className={`
                  flex items-center justify-between px-2 sm:px-3 py-2 sm:py-2.5 lg:py-3
                  ${index !== steakLineTeam - 1 ? 'border-b border-gray-800/30' : ''}
                  hover:bg-emerald-950/35 transition-colors
                `}
                style={{
                  backgroundColor: `rgba(6, 80, 60, ${intensity / 100})`,
                }}
              >
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-900/35 text-emerald-500/90 font-mono text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-xs sm:text-sm lg:text-base text-gray-300 font-medium truncate">
                    {team.name}
                  </span>
                  {!live && (
                    <span className="hidden sm:inline text-gray-600 text-xs tabular-nums shrink-0">
                      {team.record}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 font-mono shrink-0">
                  <span className="text-[10px] sm:text-xs lg:text-sm tabular-nums text-gray-400 w-12 sm:w-16 lg:w-20 text-right">
                    {Number(team.pointsInt).toLocaleString('en-US')}
                    <span className="text-[0.75em] text-gray-600">
                      .{team.pointsDec}
                    </span>
                  </span>
                  <span className="w-14 sm:w-20 lg:w-24 text-right text-xs sm:text-sm lg:text-base tabular-nums text-emerald-500/90 font-semibold">
                    +{team.gapInt}
                    <span className="text-[0.75em] text-emerald-500/50">
                      .{team.gapDec}
                    </span>
                  </span>
                  {live && (
                    <RemainingPlayersIndicator team={team} variant="eater" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Self-buyer spot - on the line */}
      {selfBuyerSpot && teamsWithGap[steakLineTeam] && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-gray-600/30 to-transparent" />
            <span className="text-[10px] uppercase tracking-widest text-gray-500/60 font-medium">
              Self Buyer
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-gray-600/30 to-transparent" />
          </div>
          <div className="rounded-lg border border-gray-700/40 overflow-hidden">
            <div className="flex items-center justify-between px-2 sm:px-3 py-2 sm:py-2.5 lg:py-3">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-800/50 text-gray-400 font-mono text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                  {steakLineTeam + 1}
                </span>
                <span className="text-xs sm:text-sm lg:text-base text-gray-300 font-medium truncate">
                  {teamsWithGap[steakLineTeam].name}
                </span>
                {!live && (
                  <span className="hidden sm:inline text-gray-600 text-xs tabular-nums shrink-0">
                    {teamsWithGap[steakLineTeam].record}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 font-mono shrink-0">
                <span className="text-[10px] sm:text-xs lg:text-sm tabular-nums text-gray-400 w-12 sm:w-16 lg:w-20 text-right">
                  {Number(teamsWithGap[steakLineTeam].pointsInt).toLocaleString(
                    'en-US',
                  )}
                  <span className="text-[0.75em] text-gray-600">
                    .{teamsWithGap[steakLineTeam].pointsDec}
                  </span>
                </span>
                <span className="w-14 sm:w-20 lg:w-24 text-right text-xs sm:text-sm lg:text-base tabular-nums text-gray-500 font-semibold">
                  —
                </span>
                {live && (
                  <RemainingPlayersIndicator
                    team={teamsWithGap[steakLineTeam]}
                    variant="self-buyer"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teams below the line - buying steaks */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-gradient-to-r from-red-500/30 to-transparent" />
          <span className="text-[10px] uppercase tracking-widest text-red-400/55 font-medium">
            Buyers
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-red-500/30 to-transparent" />
        </div>
        <div className="rounded-lg border border-gray-800/45 overflow-hidden">
          {teamsWithGap
            .slice(selfBuyerSpot ? steakLineTeam + 1 : steakLineTeam)
            .map((team, index) => {
              const actualIndex = selfBuyerSpot
                ? steakLineTeam + 1 + index
                : steakLineTeam + index;
              const isLast = actualIndex === teamsWithGap.length - 1;
              const cappedGap = Math.min(team.gapNum, 130);
              const intensity = Math.round((cappedGap / 130) * 40) + 5;
              return (
                <div
                  key={team.id}
                  className={`
                    flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 lg:py-2.5
                    ${!isLast ? 'border-b border-gray-800/25' : ''}
                    hover:bg-red-950/25 transition-colors
                  `}
                  style={{
                    backgroundColor: `rgba(130, 28, 28, ${intensity / 100})`,
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-800/35 text-gray-500 font-mono text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                      {actualIndex + 1}
                    </span>
                    <span className="text-xs sm:text-sm lg:text-base text-gray-400 truncate">
                      {team.name}
                    </span>
                    {!live && (
                      <span className="hidden sm:inline text-gray-600 text-xs tabular-nums shrink-0">
                        {team.record}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 font-mono shrink-0">
                    <span className="text-[10px] sm:text-xs lg:text-sm tabular-nums text-gray-500 w-12 sm:w-16 lg:w-20 text-right">
                      {Number(team.pointsInt).toLocaleString('en-US')}
                      <span className="text-[0.75em] text-gray-600">
                        .{team.pointsDec}
                      </span>
                    </span>
                    <span className="w-14 sm:w-20 lg:w-24 text-right text-xs sm:text-sm lg:text-base tabular-nums text-red-500/80 font-semibold">
                      {team.gapInt}
                      <span className="text-[0.75em] text-red-500/45">
                        .{team.gapDec}
                      </span>
                    </span>
                    {live && (
                      <RemainingPlayersIndicator team={team} variant="buyer" />
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
