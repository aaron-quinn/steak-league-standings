import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import SectionLabel from '@/components/SectionLabel';
import MatchupsPlaceholder from '@/components/MatchupsPlaceholder';
import FunNav from '@/components/fun/FunNav';
import FollowSelect from '@/components/fun/FollowSelect';
import { getWeeklyScores, getWeekPlayers } from '@/api/fun';
import { getWeek } from '@/api';
import { getMatchups } from '@/api/matchups';
import { useStandingsStore } from '@/stores/standings';
import type { WeekPlayer } from '@/types/Fun';
import { getTeamManagers } from '@/utils/steak-teams';
import {
  POSITION_FILTERS,
  matchesPosition,
  playersFromMatchups,
  positionLabel,
  type PositionFilter,
} from '@/utils/week-players';

const PAGE_SIZE = 25;

const positionColors: Record<string, string> = {
  QB: 'bg-rose-500/15 text-rose-300',
  RB: 'bg-emerald-500/15 text-emerald-300',
  WR: 'bg-sky-500/15 text-sky-300',
  TE: 'bg-amber-500/15 text-amber-300',
  K: 'bg-gray-500/15 text-gray-300',
};
const idpColor = 'bg-violet-500/15 text-violet-300';

const medalColors = ['text-amber-300', 'text-gray-300', 'text-orange-400'];

interface Props {
  // Only players left on a bench, and only the teams that benched them
  bench: boolean;
}

export default function TopPlayersView({ bench }: Props) {
  const year = useStandingsStore((state) => state.year);
  const [searchParams, setSearchParams] = useSearchParams();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [onlyFollowed, setOnlyFollowed] = useState(false);

  const position = (POSITION_FILTERS.find(
    (f) => f.value === searchParams.get('pos'),
  )?.value ?? 'all') as PositionFilter;

  const { data: weekData, isError: weekError } = useQuery({
    queryKey: ['week', year],
    queryFn: () => getWeek(year),
  });
  const { data: weeklyScores, isError: weeksError } = useQuery({
    queryKey: ['weekly-scores', year],
    queryFn: () => getWeeklyScores(year),
  });
  // Shared with the matchups page
  const { data: matchups, isError: liveError } = useQuery({
    queryKey: ['matchups', year],
    queryFn: () => getMatchups(`/live-matchups/${year}`),
  });

  const playedWeeks = weeklyScores?.map((w) => w.week) ?? [];
  const lastPlayed = playedWeeks[playedWeeks.length - 1] ?? 0;
  const livePlayers = useMemo(
    () => (matchups ? playersFromMatchups(matchups) : []),
    [matchups],
  );
  const liveWeek =
    weekData && weekData.week > lastPlayed && livePlayers.length > 0
      ? weekData.week
      : null;
  const weeks = liveWeek ? [...playedWeeks, liveWeek] : playedWeeks;

  // Default to the week in progress once anyone has scored, otherwise the
  // last finished week
  const liveHasScores = livePlayers.some((p) => p.score !== 0);
  const defaultWeek =
    liveWeek && (liveHasScores || !lastPlayed) ? liveWeek : lastPlayed;
  const requestedWeek = Number(searchParams.get('week'));
  const week = weeks.includes(requestedWeek) ? requestedWeek : defaultWeek;
  const isLive = week === liveWeek;

  const { data: playedData, isError: playedError } = useQuery({
    queryKey: ['week-players', year, week],
    queryFn: () => getWeekPlayers(year, week),
    enabled: Boolean(week) && !isLive,
  });

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    setSearchParams(next, { replace: true });
    setShown(PAGE_SIZE);
  };

  const managers = useMemo(() => getTeamManagers(year), [year]);

  // Followed by manager name, shared with the Steak Race through the URL
  const followName = searchParams.get('follow');
  const followed =
    [...managers.values()].find((m) => m.name === followName)?.id ?? null;
  const setFollowed = (id: string | null) =>
    updateParams({ follow: (id && managers.get(id)?.name) || null });

  const players = useMemo(() => {
    const source = isLive ? livePlayers : (playedData?.players ?? []);
    return source
      .map((player) =>
        bench
          ? { ...player, owners: player.owners.filter((o) => !o.starter) }
          : player,
      )
      .filter(
        (player) =>
          player.owners.length > 0 &&
          player.score !== 0 &&
          matchesPosition(position, player.position),
      );
  }, [isLive, livePlayers, playedData, bench, position]);

  // Points each team left on its bench this week
  const benchLeaders = useMemo(() => {
    if (!bench) return [];
    const totals = new Map<string, number>();
    const source = isLive ? livePlayers : (playedData?.players ?? []);
    source.forEach((player) =>
      player.owners
        .filter((o) => !o.starter)
        .forEach((o) =>
          totals.set(
            o.franchiseID,
            (totals.get(o.franchiseID) ?? 0) + player.score,
          ),
        ),
    );
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, total]) => total > 0);
  }, [bench, isLive, livePlayers, playedData]);

  // Finished weeks still work if the live matchups or week lookup fail
  const loading =
    (!weekData && !weekError) ||
    !weeklyScores ||
    (!matchups && !liveError) ||
    (Boolean(week) && !isLive && !playedData);
  const failed = weeksError || (!isLive && playedError);
  const weekIndex = weeks.indexOf(week);

  const isFollowed = (player: WeekPlayer) =>
    player.owners.some((owner) => owner.franchiseID === followed);
  const followedPlayers = followed ? players.filter(isFollowed) : [];
  // Their players alone, keeping each one's overall rank
  const showingOnlyFollowed = onlyFollowed && followedPlayers.length > 0;
  const listed = showingOnlyFollowed ? followedPlayers : players;

  return (
    <PageShell>
      <FunNav />

      {/* Week picker */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <WeekButton
            direction="previous"
            disabled={weekIndex <= 0}
            onClick={() => updateParams({ week: String(weeks[weekIndex - 1]) })}
          />
          <div className="min-w-[88px] text-center">
            <div className="text-sm sm:text-base font-semibold text-gray-100">
              {week ? `Week ${week}` : 'Week'}
            </div>
            <div
              className={clsx(
                'text-[10px] uppercase tracking-widest',
                isLive ? 'text-emerald-400' : 'text-gray-600',
              )}
            >
              {isLive ? 'In progress' : 'Final'}
            </div>
          </div>
          <WeekButton
            direction="next"
            disabled={weekIndex === -1 || weekIndex >= weeks.length - 1}
            onClick={() => updateParams({ week: String(weeks[weekIndex + 1]) })}
          />
        </div>
        <FollowSelect
          options={[...managers.values()]}
          value={followed}
          onChange={setFollowed}
          className="w-full sm:w-auto sm:flex-1 sm:justify-end"
        />
      </div>

      {/* Position filters, scrolling sideways on narrow screens */}
      <div
        role="group"
        aria-label="Position"
        className="-mx-2 mb-4 flex gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {POSITION_FILTERS.map((filter) => {
          const active = filter.value === position;
          return (
            <button
              type="button"
              key={filter.value}
              aria-pressed={active}
              onClick={() =>
                updateParams({
                  pos: filter.value === 'all' ? null : filter.value,
                })
              }
              className={clsx(
                'h-7 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                active
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                  : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700 hover:text-gray-200',
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {failed ? (
        <MatchupsPlaceholder
          title="Players Unavailable"
          message="We were unable to load this week’s scores. Please try again later."
        />
      ) : loading ? (
        <div className="space-y-1.5" role="status" aria-label="Loading">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-gray-950/60"
            />
          ))}
        </div>
      ) : weeks.length === 0 ? (
        <MatchupsPlaceholder
          title="No Scores Yet"
          message="Player scores appear once the season kicks off."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={bench ? 'lg:col-span-8' : 'lg:col-span-12'}>
            {players.length === 0 ? (
              <p className="rounded-lg border border-gray-800/60 bg-gray-950/30 px-4 py-10 text-center text-sm text-gray-500">
                No {bench ? 'bench ' : ''}points at this position yet.
              </p>
            ) : (
              <>
                {followed && (
                  <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-xs sm:text-sm">
                    <span className="min-w-0 truncate text-amber-200">
                      <span className="font-semibold">
                        {managers.get(followed)?.name}
                      </span>
                      <span className="text-amber-200/70">
                        {followedPlayers.length === 0
                          ? bench
                            ? ' · no bench points here'
                            : ' · no players here'
                          : ` · ${followedPlayers.length} player${
                              followedPlayers.length === 1 ? '' : 's'
                            } · ${followedPlayers
                              .reduce((sum, p) => sum + p.score, 0)
                              .toFixed(2)} pts`}
                      </span>
                    </span>
                    {followedPlayers.length > 0 && (
                      <button
                        type="button"
                        aria-pressed={onlyFollowed}
                        onClick={() => setOnlyFollowed((only) => !only)}
                        className="shrink-0 font-medium text-amber-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      >
                        {onlyFollowed ? 'Show everyone' : 'Only theirs'}
                      </button>
                    )}
                  </div>
                )}
                <ol
                  className={clsx(
                    'rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40',
                    !bench && 'lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-x-6',
                  )}
                >
                  {listed.slice(0, shown).map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      rank={players.indexOf(player) + 1}
                      managers={managers}
                      showBenchTag={!bench}
                      followed={followed}
                    />
                  ))}
                </ol>
                {listed.length > shown && (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE_SIZE)}
                    className="mt-2 w-full rounded-lg border border-gray-800/60 py-2 text-xs sm:text-sm text-gray-400 transition-colors hover:border-gray-700 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    Show more
                  </button>
                )}
              </>
            )}
          </div>

          {bench && benchLeaders.length > 0 && (
            <div className="lg:col-span-4 -order-1 lg:order-none">
              <SectionLabel tone="green">Most points on the bench</SectionLabel>
              <ol className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                {benchLeaders.map(([franchiseID, total], index) => {
                  const manager = managers.get(franchiseID);
                  return (
                    <li
                      key={franchiseID}
                      className={clsx(
                        'rounded-lg border px-2.5 py-2 sm:px-3 lg:flex lg:items-center lg:gap-3',
                        franchiseID === followed
                          ? 'border-amber-300/50 bg-amber-300/10'
                          : 'border-gray-800/60 bg-gray-950/30',
                      )}
                    >
                      <div
                        className={clsx(
                          'font-mono text-[10px] sm:text-xs font-semibold',
                          medalColors[index],
                        )}
                      >
                        #{index + 1}
                      </div>
                      <div className="min-w-0 lg:flex-1">
                        <div
                          className={clsx(
                            'truncate text-xs sm:text-sm font-medium',
                            franchiseID === followed
                              ? 'text-amber-200'
                              : manager?.steak
                                ? 'text-emerald-400'
                                : 'text-gray-300',
                          )}
                        >
                          {manager?.name ?? franchiseID}
                        </div>
                      </div>
                      <div className="font-mono text-base sm:text-lg font-semibold text-gray-100 tabular-nums">
                        {total.toFixed(2)}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function WeekButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${direction === 'previous' ? 'Previous' : 'Next'} week`}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-800 bg-gray-950 text-gray-400 transition-colors hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <svg
        viewBox="0 0 16 16"
        className={clsx('h-4 w-4', direction === 'next' && 'rotate-180')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 3 5 8l5 5" />
      </svg>
    </button>
  );
}

function PlayerRow({
  player,
  rank,
  managers,
  showBenchTag,
  followed,
}: {
  player: WeekPlayer;
  rank: number;
  managers: ReturnType<typeof getTeamManagers>;
  showBenchTag: boolean;
  followed: string | null;
}) {
  const label = positionLabel(player.position);
  const [int, dec] = player.score.toFixed(2).split('.');
  const highlighted = player.owners.some(
    (owner) => owner.franchiseID === followed,
  );
  return (
    <li
      className={clsx(
        'flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-2 lg:border-b lg:border-gray-800/40 transition-colors duration-200',
        highlighted
          ? 'bg-amber-300/10 shadow-[inset_3px_0_0_rgba(252,211,77,0.8)]'
          : followed && 'opacity-60',
      )}
    >
      <span
        className={clsx(
          'w-5 sm:w-6 shrink-0 text-right font-mono text-xs sm:text-sm tabular-nums',
          medalColors[rank - 1] ?? 'text-gray-600',
          rank <= 3 && 'font-bold',
        )}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-gray-100">
            {player.name}
          </span>
          <span
            className={clsx(
              'shrink-0 rounded px-1 py-px font-mono text-[9px] sm:text-[10px] font-semibold',
              positionColors[label] ?? idpColor,
            )}
          >
            {label}
          </span>
          <span className="shrink-0 text-[10px] sm:text-xs text-gray-600">
            {player.team}
          </span>
          {player.gameStatus === 'in-progress' && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 motion-safe:animate-pulse"
              title="Playing now"
            />
          )}
        </div>
        <div className="truncate text-[11px] sm:text-xs text-gray-500">
          {player.owners.map((owner, i) => {
            const manager = managers.get(owner.franchiseID);
            return (
              <span key={owner.franchiseID}>
                {i > 0 && ' · '}
                <span
                  className={
                    owner.franchiseID === followed
                      ? 'font-semibold text-amber-200'
                      : manager?.steak
                        ? 'text-emerald-500/80'
                        : undefined
                  }
                >
                  {manager?.name ?? owner.franchiseID}
                </span>
                {showBenchTag && !owner.starter && (
                  <span className="ml-1 rounded bg-gray-800 px-1 text-[9px] font-semibold uppercase text-gray-400">
                    Bench
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <span className="shrink-0 font-mono text-base sm:text-lg font-semibold text-gray-100 tabular-nums">
        {int}
        <span className="text-[0.7em] text-gray-500">.{dec}</span>
      </span>
    </li>
  );
}
