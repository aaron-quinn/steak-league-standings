import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import SectionLabel from '@/components/SectionLabel';
import SegmentedTabs from '@/components/SegmentedTabs';
import MatchupsPlaceholder from '@/components/MatchupsPlaceholder';
import FunNav from '@/components/fun/FunNav';
import FollowSelect from '@/components/fun/FollowSelect';
import PositionBadge from '@/components/fun/PositionBadge';
import PositionFilters from '@/components/fun/PositionFilters';
import { getWaivers } from '@/api/fun';
import { useStandingsStore } from '@/stores/standings';
import type { WaiverPickup } from '@/types/Fun';
import type { MatchupManager } from '@/types/MatchupManager';
import { LEAGUE_NAMES } from '@/utils/draft';
import { getTeamManagers } from '@/utils/steak-teams';
import {
  POSITION_FILTERS,
  matchesPosition,
  type PositionFilter,
} from '@/utils/week-players';
import {
  getWaiverAwards,
  getWaiverTeams,
  groupByPlayer,
  pickupKey,
  type PickupGroup,
  pointsPerDollar,
  sortPickups,
  type WaiverSort,
} from '@/utils/waivers';

// Seasons with both leagues in the managers data
const FIRST_SEASON = 2016;
const PAGE_SIZE = 25;
// A week this big fills a sparkline bar
const SPARK_MAX = 30;

const medalColors = ['text-amber-300', 'text-gray-300', 'text-orange-400'];

const LEAGUE_TABS = [
  { value: 'all', label: 'Both' },
  ...Object.entries(LEAGUE_NAMES).map(([value, label]) => ({ value, label })),
];

// Franchise IDs start with their league's name
const inLeague = (league: string, franchiseID: string) =>
  league === 'all' || franchiseID.startsWith(league);

const SORTS: { value: WaiverSort; label: string }[] = [
  { value: 'points', label: 'Points' },
  { value: 'value', label: 'Value' },
  { value: 'price', label: 'Priciest' },
];

export default function WaiversView() {
  const currentYear = useStandingsStore((state) => state.year);
  const [searchParams, setSearchParams] = useSearchParams();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [onlyFollowed, setOnlyFollowed] = useState(false);

  const seasons = Array.from(
    { length: currentYear - FIRST_SEASON + 1 },
    (_, i) => currentYear - i,
  );
  const requestedSeason = Number(searchParams.get('season'));
  const year = seasons.includes(requestedSeason)
    ? requestedSeason
    : currentYear;
  const sort = (SORTS.find((s) => s.value === searchParams.get('sort'))
    ?.value ?? 'points') as WaiverSort;
  const position = (POSITION_FILTERS.find(
    (f) => f.value === searchParams.get('pos'),
  )?.value ?? 'all') as PositionFilter;
  const positionName =
    position === 'all'
      ? ''
      : POSITION_FILTERS.find((f) => f.value === position)!.label;
  const league =
    LEAGUE_TABS.find((tab) => tab.value === searchParams.get('league'))
      ?.value ?? 'all';
  // What the filters leave showing, like "Madison RB"
  const scope = [LEAGUE_NAMES[league], positionName].filter(Boolean).join(' ');

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    setSearchParams(next, { replace: true });
    setShown(PAGE_SIZE);
  };

  const { data, isError, isPending } = useQuery({
    queryKey: ['waivers', year],
    queryFn: () => getWaivers(year),
  });

  // Everything below, awards and budgets included, covers just the chosen
  // league's teams and position's pickups
  const season = useMemo(
    () =>
      data && {
        ...data,
        pickups: data.pickups.filter(
          (p) =>
            inLeague(league, p.franchiseID) &&
            matchesPosition(position, p.player.position),
        ),
      },
    [data, position, league],
  );

  const managers = useMemo(
    () =>
      new Map(
        [...getTeamManagers(year)].filter(([id]) => inLeague(league, id)),
      ),
    [year, league],
  );
  const awards = useMemo(
    () => (season ? getWaiverAwards(season, managers) : []),
    [season, managers],
  );
  const teams = useMemo(
    () => (season ? getWaiverTeams(season, managers) : []),
    [season, managers],
  );
  const pickups = useMemo(
    () => (season ? sortPickups(season.pickups, sort) : []),
    [season, sort],
  );

  // Followed by manager name, shared with the other Fun screens
  const followName = searchParams.get('follow');
  const followed =
    [...managers.values()].find((m) => m.name === followName)?.id ?? null;
  const setFollowed = (id: string | null) =>
    updateParams({ follow: (id && managers.get(id)?.name) || null });

  // One row per player, however many teams picked him up
  const groups = useMemo(
    () => (season ? groupByPlayer(pickups, season.pickups) : []),
    [pickups, season],
  );
  const ranks = useMemo(
    () => new Map(groups.map((g, i) => [g.lead.player.id, i + 1])),
    [groups],
  );

  const isTheirs = (p: WaiverPickup) => p.franchiseID === followed;
  const followedPickups = pickups.filter(isTheirs);
  const followedTeam = teams.find((team) => team.id === followed);
  const showingOnlyFollowed = onlyFollowed && followedPickups.length > 0;
  // Their players alone, led by their own pickups, keeping each player's
  // overall rank
  const listed = showingOnlyFollowed
    ? groupByPlayer(followedPickups, season?.pickups.filter(isTheirs) ?? [])
    : groups;

  return (
    <PageShell>
      <FunNav />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="w-52 sm:w-60">
          <SegmentedTabs
            label="League"
            tabs={LEAGUE_TABS}
            value={league}
            onChange={(value) =>
              updateParams({ league: value === 'all' ? null : value })
            }
          />
        </div>
        <div className="w-56 sm:w-64">
          <SegmentedTabs
            label="Sort pickups"
            tabs={SORTS}
            value={sort}
            onChange={(value) =>
              updateParams({ sort: value === 'points' ? null : value })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 sm:order-last">
          Season
          <select
            value={year}
            onChange={(event) =>
              updateParams({
                season:
                  Number(event.target.value) === currentYear
                    ? null
                    : event.target.value,
              })
            }
            className="rounded-md border-gray-800 bg-gray-950 py-1 pl-2 pr-8 text-xs sm:text-sm font-medium text-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <FollowSelect
          options={[...managers.values()]}
          value={followed}
          onChange={setFollowed}
          className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:justify-end"
        />
      </div>

      <PositionFilters
        value={position}
        onChange={(value) =>
          updateParams({ pos: value === 'all' ? null : value })
        }
        className="mb-4"
      />

      {isError ? (
        <MatchupsPlaceholder
          title="Waivers Unavailable"
          message="We were unable to load this season’s pickups. Please try again later."
        />
      ) : isPending ? (
        <div className="space-y-4" role="status" aria-label="Loading">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-lg bg-gray-950/60"
              />
            ))}
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-gray-950/60"
            />
          ))}
        </div>
      ) : data.pickups.length === 0 ? (
        <MatchupsPlaceholder
          title="No Pickups Yet"
          message="The waiver wire opens once the draft is done."
        />
      ) : (
        <>
          {awards.length > 0 && (
            <section className="mb-6">
              <SectionLabel tone="green">
                {`${year} ${scope ? `${scope} ` : ''}Waiver Awards${
                  data.lastWeek ? ` · Through Week ${data.lastWeek}` : ''
                }`}
              </SectionLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {awards.map((award) => {
                  const isFollowed = award.teamID === followed;
                  return (
                    <button
                      type="button"
                      key={award.title}
                      onClick={() =>
                        setFollowed(isFollowed ? null : award.teamID)
                      }
                      aria-pressed={isFollowed}
                      className={clsx(
                        'group rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                        isFollowed
                          ? 'border-amber-300/40 bg-amber-300/5'
                          : 'border-gray-800/60 bg-gray-950/30 hover:border-gray-700/80',
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-500">
                        <span
                          aria-hidden="true"
                          className="text-sm leading-none transition-transform duration-200 ease-out group-hover:-rotate-12 group-hover:scale-125 motion-reduce:transition-none"
                        >
                          {award.emoji}
                        </span>
                        <span className="truncate">{award.title}</span>
                      </div>
                      <div className="mt-1 font-mono text-lg sm:text-xl font-semibold text-gray-100 tabular-nums">
                        {award.stat}
                      </div>
                      <div
                        className={clsx(
                          'truncate text-[11px] sm:text-xs font-medium',
                          isFollowed ? 'text-amber-200' : 'text-gray-300',
                        )}
                      >
                        {award.headline}
                      </div>
                      <div className="mt-0.5 text-[11px] sm:text-xs text-gray-500 line-clamp-2">
                        {award.detail}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-8">
              <SectionLabel>
                {`${
                  sort === 'value'
                    ? 'Most points per dollar'
                    : sort === 'price'
                      ? 'Biggest bids'
                      : 'Best pickups'
                }${scope ? ` · ${scope}` : ''}`}
              </SectionLabel>

              {followed && followedTeam && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-xs sm:text-sm">
                  <span className="min-w-0 truncate text-amber-200">
                    <span className="font-semibold">{followedTeam.name}</span>
                    <span className="text-amber-200/70">
                      {followedTeam.moves === 0
                        ? ` · no ${positionName ? `${positionName} ` : ''}pickups`
                        : ` · ${followedTeam.moves} pickup${
                            followedTeam.moves === 1 ? '' : 's'
                          } · $${followedTeam.spent} spent · ${followedTeam.started.toFixed(2)} pts started`}
                    </span>
                  </span>
                  {followedPickups.length > 0 && (
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

              {listed.length === 0 ? (
                <p className="rounded-lg border border-gray-800/60 bg-gray-950/30 px-4 py-10 text-center text-sm text-gray-500">
                  {season!.pickups.length === 0
                    ? `No ${scope} pickups yet.`
                    : `No paid ${scope ? `${scope} ` : ''}bids yet. Everyone’s been shopping for free.`}
                </p>
              ) : (
                <>
                  <ol className="rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40">
                    {listed.slice(0, shown).map((group) => (
                      <PickupRow
                        key={pickupKey(group.lead)}
                        group={group}
                        rank={ranks.get(group.lead.player.id) ?? 0}
                        sort={sort}
                        managers={managers}
                        followed={followed}
                        lastWeek={data.lastWeek}
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
              <p className="mt-2 text-[11px] sm:text-xs text-gray-600">
                Points scored while on the team that added him. Bars show each
                week, green when he started.
              </p>
            </section>

            <section className="lg:col-span-4">
              <SectionLabel>Front Office</SectionLabel>
              <ol className="rounded-lg border border-gray-800/60 divide-y divide-gray-800/40">
                {teams.map((team, index) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    rank={index + 1}
                    badges={teamBadges(teams, team.id)}
                    isFollowed={team.id === followed}
                    onSelect={() =>
                      setFollowed(team.id === followed ? null : team.id)
                    }
                  />
                ))}
              </ol>
              <p className="mt-2 text-[11px] sm:text-xs text-gray-600">
                Points started from pickups, and how much of the season’s budget
                is gone.
              </p>
            </section>
          </div>
        </>
      )}
    </PageShell>
  );
}

type Team = ReturnType<typeof getWaiverTeams>[number];

// Tongue-in-cheek labels for the extremes of the front office. A tie for
// first or last earns nothing, so early in a season no one is a tightwad.
function teamBadges(teams: Team[], id: string) {
  const team = teams.find((t) => t.id === id)!;
  const alone = (value: (t: Team) => number, pick: typeof Math.max) => {
    const target = pick(...teams.map(value));
    return (
      value(team) === target &&
      teams.filter((t) => value(t) === target).length === 1
    );
  };
  const badges: string[] = [];
  if (alone((t) => t.spent, Math.max)) badges.push('Big Spender');
  if (alone((t) => t.spent, Math.min)) badges.push('Tightwad');
  if (alone((t) => t.moves, Math.max)) badges.push('Wire Addict');
  return badges;
}

function PickupRow({
  group,
  rank,
  sort,
  managers,
  followed,
  lastWeek,
}: {
  group: PickupGroup;
  rank: number;
  sort: WaiverSort;
  managers: ReturnType<typeof getTeamManagers>;
  followed: string | null;
  lastWeek: number;
}) {
  const { lead: pickup, others } = group;
  const manager = managers.get(pickup.franchiseID);
  const leadIsTheirs = pickup.franchiseID === followed;
  const otherIsTheirs = others.some((p) => p.franchiseID === followed);
  const highlighted = leadIsTheirs || otherIsTheirs;
  // Opens by itself when the followed team's pickup is tucked inside
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? otherIsTheirs;
  const [int, dec] = pickup.points.toFixed(2).split('.');
  const dropped = pickup.dropped.map((p) => p.name).join(', ');
  const teamCount = new Set([pickup, ...others].map((p) => p.franchiseID)).size;

  return (
    <li
      className={clsx(
        'px-2.5 sm:px-3 py-2 transition-colors duration-200',
        highlighted
          ? 'bg-amber-300/10 shadow-[inset_3px_0_0_rgba(252,211,77,0.8)]'
          : followed && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
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
              {pickup.player.name}
            </span>
            <PositionBadge position={pickup.player.position} />
            <span className="shrink-0 text-[10px] sm:text-xs text-gray-600">
              {pickup.player.team}
            </span>
          </div>
          <div className="truncate text-[11px] sm:text-xs text-gray-500">
            <TeamName
              manager={manager}
              id={pickup.franchiseID}
              followed={leadIsTheirs}
            />
            {pickup.week !== null && ` · Wk ${pickup.week}`}
            {dropped && ` · for ${dropped}`}
          </div>
          {others.length > 0 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(!expanded)}
              className="mt-0.5 flex items-center gap-1 rounded text-[11px] sm:text-xs text-gray-500 transition-colors hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <svg
                viewBox="0 0 16 16"
                className={clsx(
                  'h-3 w-3 transition-transform duration-200 ease-out motion-reduce:transition-none',
                  expanded && 'rotate-90',
                )}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 3l5 5-5 5" />
              </svg>
              {`Picked up ${others.length + 1}×`}
              {teamCount > 1 && ` by ${teamCount} teams`}
            </button>
          )}
        </div>
        <Sparkline pickup={pickup} lastWeek={lastWeek} />
        <CostTag cost={pickup.cost} bid={pickup.bid} />
        <div className="min-w-[4rem] sm:min-w-[5rem] shrink-0 whitespace-nowrap text-right">
          {sort === 'value' ? (
            <>
              <div className="font-mono text-base sm:text-lg font-semibold text-gray-100 tabular-nums">
                {pointsPerDollar(pickup).toFixed(1)}
              </div>
              <div className="text-[10px] text-gray-500 tabular-nums">
                pts per $
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-base sm:text-lg font-semibold text-gray-100 tabular-nums">
                {int}
                <span className="text-[0.7em] text-gray-500">.{dec}</span>
              </div>
              <div className="text-[10px] text-gray-500 tabular-nums">
                {pickup.started.toFixed(2)} started
              </div>
            </>
          )}
        </div>
      </div>
      {expanded && others.length > 0 && (
        <ul className="mt-1.5 ml-7 sm:ml-9 space-y-1 border-l border-gray-800 pl-2.5">
          {others.map((other) => (
            <li
              key={pickupKey(other)}
              className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500"
            >
              <span className="min-w-0 flex-1 truncate">
                <TeamName
                  manager={managers.get(other.franchiseID)}
                  id={other.franchiseID}
                  followed={other.franchiseID === followed}
                />
                {other.week !== null && ` · Wk ${other.week}`}
                {other.dropped.length > 0 &&
                  ` · for ${other.dropped.map((p) => p.name).join(', ')}`}
              </span>
              <CostTag cost={other.cost} bid={other.bid} />
              <span className="min-w-[4rem] sm:min-w-[5rem] shrink-0 text-right font-mono tabular-nums text-gray-300">
                {sort === 'value' && other.cost > 0
                  ? `${pointsPerDollar(other).toFixed(1)}/$`
                  : other.points.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function TeamName({
  manager,
  id,
  followed,
}: {
  manager: MatchupManager | undefined;
  id: string;
  followed: boolean;
}) {
  return (
    <span
      className={
        followed
          ? 'font-semibold text-amber-200'
          : manager?.steak
            ? 'text-emerald-500/80'
            : undefined
      }
    >
      {manager?.name ?? id}
    </span>
  );
}

// Free pickups in green, bids warming from gray to red as they get bigger
function CostTag({ cost, bid }: { cost: number; bid: boolean }) {
  return (
    <span
      title={bid ? `Won with a $${cost} bid` : 'Signed as a free agent'}
      className={clsx(
        'w-11 shrink-0 rounded-md px-1 py-0.5 text-center font-mono text-[11px] sm:text-xs font-semibold tabular-nums',
        cost === 0
          ? 'bg-emerald-500/10 text-emerald-300'
          : cost < 10
            ? 'bg-gray-800/80 text-gray-200'
            : cost < 25
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-red-500/15 text-red-300',
      )}
    >
      {cost === 0 ? 'FREE' : `$${cost}`}
    </span>
  );
}

// One bar per week from the pickup to the latest week played. A gap is a
// week off the roster.
function Sparkline({
  pickup,
  lastWeek,
}: {
  pickup: WaiverPickup;
  lastWeek: number;
}) {
  if (pickup.week === null || pickup.week > lastWeek) return null;
  const lastGame = pickup.games[pickup.games.length - 1]?.week ?? pickup.week;
  const weeks = Array.from(
    { length: Math.min(lastGame, lastWeek) - pickup.week + 1 },
    (_, i) => pickup.week! + i,
  );
  const byWeek = new Map(pickup.games.map((g) => [g.week, g]));
  return (
    <div
      aria-hidden="true"
      className="hidden sm:flex h-6 w-24 shrink-0 items-end justify-end gap-px"
    >
      {weeks.slice(-18).map((week) => {
        const game = byWeek.get(week);
        const height = game
          ? Math.max(8, Math.min(100, (game.score / SPARK_MAX) * 100))
          : 0;
        return (
          <span
            key={week}
            title={
              game
                ? `Week ${week}: ${game.score.toFixed(2)}${game.starter ? '' : ' (bench)'}`
                : undefined
            }
            className={clsx(
              'w-1 rounded-sm',
              !game
                ? 'h-px bg-gray-800'
                : game.starter
                  ? 'bg-emerald-400/80'
                  : 'bg-gray-600',
            )}
            style={game ? { height: `${height}%` } : undefined}
          />
        );
      })}
    </div>
  );
}

function TeamRow({
  team,
  rank,
  badges,
  isFollowed,
  onSelect,
}: {
  team: Team;
  rank: number;
  badges: string[];
  isFollowed: boolean;
  onSelect: () => void;
}) {
  const share = team.budget ? Math.min(1, team.spent / team.budget) : 0;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isFollowed}
        className={clsx(
          'w-full px-3 py-2 text-left text-xs sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400',
          isFollowed ? 'bg-amber-300/10' : 'hover:bg-gray-900/40',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right font-mono text-gray-500 tabular-nums">
            {rank}
          </span>
          <span
            className={clsx(
              'min-w-0 flex-1 truncate',
              isFollowed
                ? 'font-semibold text-amber-200'
                : team.steak
                  ? 'text-emerald-400'
                  : 'text-gray-300',
            )}
          >
            {team.name}
          </span>
          <span className="shrink-0 font-mono text-gray-400 tabular-nums">
            {team.started.toFixed(2)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 pl-7">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800/80"
            title={
              team.budget
                ? `$${team.spent} of $${team.budget} spent`
                : `$${team.spent} spent`
            }
          >
            <div
              className={clsx(
                'h-full rounded-full',
                share >= 1
                  ? 'bg-red-400/80'
                  : share >= 0.75
                    ? 'bg-amber-400/80'
                    : 'bg-emerald-400/70',
              )}
              style={{ width: `${share * 100}%` }}
            />
          </div>
          <span className="shrink-0 whitespace-nowrap text-right font-mono text-[10px] sm:text-[11px] text-gray-500 tabular-nums">
            {team.budget !== null
              ? `$${Math.max(0, team.budget - team.spent)} left`
              : `$${team.spent} spent`}
            {` · ${team.moves} add${team.moves === 1 ? '' : 's'}`}
          </span>
        </div>
        {(badges.length > 0 || team.best) && (
          <div className="mt-1 flex flex-wrap items-center gap-1 pl-7 text-[10px] text-gray-600">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded bg-gray-800 px-1 font-semibold uppercase tracking-wide text-gray-300"
              >
                {badge}
              </span>
            ))}
            {team.best && team.best.points > 0 && (
              <span className="truncate">
                Best: {team.best.player.name} ({team.best.points.toFixed(2)})
              </span>
            )}
          </div>
        )}
      </button>
    </li>
  );
}
