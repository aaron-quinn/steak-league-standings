import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import PageShell from '@/components/PageShell';
import SectionLabel from '@/components/SectionLabel';
import SegmentedTabs from '@/components/SegmentedTabs';
import MatchupsPlaceholder from '@/components/MatchupsPlaceholder';
import FunNav from '@/components/fun/FunNav';
import FollowSelect from '@/components/fun/FollowSelect';
import PositionBadge from '@/components/fun/PositionBadge';
import PositionFilters from '@/components/fun/PositionFilters';
import { getDraft } from '@/api/fun';
import { useStandingsStore } from '@/stores/standings';
import type { DraftLeague } from '@/types/Draft';
import { getTeamManagers } from '@/utils/steak-teams';
import {
  POSITION_FILTERS,
  matchesPosition,
  type PositionFilter,
} from '@/utils/week-players';
import {
  LEAGUE_NAMES,
  formatDollars,
  formatValue,
  listPicks,
  priceGaps,
  teamDrafts,
  valueColor,
  type LeaguePick,
} from '@/utils/draft';

const PAGE_SIZE = 25;
const HIGHLIGHTS = 5;

const LEAGUE_TABS = [
  { value: 'all', label: 'Both' },
  ...Object.entries(LEAGUE_NAMES).map(([value, label]) => ({ value, label })),
];

type Sort = 'price' | 'value';

const byPrice = (a: LeaguePick, b: LeaguePick) =>
  b.price - a.price || a.name.localeCompare(b.name);
const byValue = (a: LeaguePick, b: LeaguePick) =>
  (b.value ?? 0) - (a.value ?? 0) || b.price - a.price;

// One place for both leagues: MFL scores Madison to tenths and LA to
// hundredths
const formatPoints = (points: number) => points.toFixed(1);

export default function DraftView() {
  const year = useStandingsStore((state) => state.year);
  const [searchParams, setSearchParams] = useSearchParams();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [onlyFollowed, setOnlyFollowed] = useState(false);

  const { data, error, isPending } = useQuery({
    queryKey: ['draft', year],
    queryFn: () => getDraft(year),
    // A season without an auction on file won't gain one by asking again
    retry: (failureCount, failure) =>
      failureCount < 2 &&
      !(
        isAxiosError(failure) &&
        [404, 503].includes(failure.response?.status ?? 0)
      ),
  });
  const notFound = isAxiosError(error) && error.response?.status === 404;
  const week = data?.week ?? 0;
  const throughWeek = week ? ` · through week ${week}` : '';

  const league =
    LEAGUE_TABS.find((tab) => tab.value === searchParams.get('league'))
      ?.value ?? 'all';
  const sort: Sort = searchParams.get('sort') === 'value' ? 'value' : 'price';
  const position = (POSITION_FILTERS.find(
    (f) => f.value === searchParams.get('pos'),
  )?.value ?? 'all') as PositionFilter;

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    setSearchParams(next, { replace: true });
    setShown(PAGE_SIZE);
  };

  const leagues = useMemo(
    () =>
      data?.leagues.filter((l) => league === 'all' || l.league === league) ??
      [],
    [data, league],
  );
  const picks = useMemo(() => listPicks(leagues), [leagues]);
  // Values need at least one scored game
  const scored =
    leagues.length > 0 && leagues.every((l) => l.pointPrice !== null);
  const byBest = useMemo(() => [...picks].sort(byValue), [picks]);
  // Best draft first once there are values, biggest spender first before
  const teams = useMemo(() => {
    const drafts = teamDrafts(picks);
    return scored ? drafts : drafts.sort((a, b) => b.spent - a.spent);
  }, [picks, scored]);
  const gaps = useMemo(() => priceGaps(picks).slice(0, 5), [picks]);

  const managers = useMemo(() => getTeamManagers(year), [year]);
  const teamOptions = useMemo(() => {
    const drafted = new Set(picks.map((pick) => pick.franchiseID));
    return [...managers.values()].filter((m) => drafted.has(m.id));
  }, [managers, picks]);

  // Followed by manager name, shared with the other Fun screens through the URL
  const followName = searchParams.get('follow');
  const followed = teamOptions.find((m) => m.name === followName)?.id ?? null;
  const setFollowed = (id: string | null) =>
    updateParams({ follow: (id && managers.get(id)?.name) || null });

  const board = useMemo(
    () =>
      picks
        .filter((pick) => matchesPosition(position, pick.position))
        .sort(sort === 'value' && scored ? byValue : byPrice),
    [picks, position, sort, scored],
  );
  const followedPicks = followed
    ? board.filter((pick) => pick.franchiseID === followed)
    : [];
  // Their picks alone, keeping each one's place on the whole board
  const showingOnlyFollowed = onlyFollowed && followedPicks.length > 0;
  const listed = showingOnlyFollowed ? followedPicks : board;

  const bothLeagues = league === 'all';
  const rowProps = { managers, followed, showLeague: bothLeagues };

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
        <FollowSelect
          options={teamOptions}
          value={followed}
          onChange={setFollowed}
          className="w-full sm:w-auto sm:flex-1 sm:justify-end"
        />
      </div>

      {notFound ? (
        <MatchupsPlaceholder
          title="No Draft Yet"
          message={`The ${year} auction results haven’t been added yet.`}
        />
      ) : error ? (
        <MatchupsPlaceholder
          title="Draft Unavailable"
          message="We were unable to load the draft values. Please try again later."
        />
      ) : isPending ? (
        <div className="space-y-1.5" role="status" aria-label="Loading">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-gray-950/60"
            />
          ))}
        </div>
      ) : (
        // On phones the side column sits between the highlights and the
        // full board
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:grid-rows-[auto_1fr]">
          {scored && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8 lg:col-start-1">
              <section>
                <SectionLabel tone="green">{`Best picks${throughWeek}`}</SectionLabel>
                <ol className="rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40">
                  {byBest.slice(0, HIGHLIGHTS).map((pick, index) => (
                    <PickRow
                      key={`${pick.league}${pick.id}`}
                      pick={pick}
                      rank={index + 1}
                      {...rowProps}
                    />
                  ))}
                </ol>
              </section>
              <section>
                <SectionLabel>{`Worst picks${throughWeek}`}</SectionLabel>
                <ol className="rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40">
                  {byBest
                    .slice(-HIGHLIGHTS)
                    .reverse()
                    .map((pick, index) => (
                      <PickRow
                        key={`${pick.league}${pick.id}`}
                        pick={pick}
                        rank={index + 1}
                        {...rowProps}
                      />
                    ))}
                </ol>
              </section>
            </div>
          )}

          <div className="space-y-6 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
            {teams.length > 0 && (
              <section>
                <SectionLabel tone={scored ? 'green' : 'gray'}>
                  Team totals
                </SectionLabel>
                <div className="rounded-lg border border-gray-800/60">
                  <div
                    className="flex items-center gap-2 border-b border-gray-800/60 px-3 py-1.5 text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-600"
                    aria-hidden="true"
                  >
                    <span className="w-5 shrink-0" />
                    <span className="min-w-0 flex-1">Team</span>
                    <span className="w-12 shrink-0 text-right">Paid</span>
                    {scored && (
                      <>
                        <span className="w-12 shrink-0 text-right">Worth</span>
                        <span className="w-12 shrink-0 text-right">Value</span>
                      </>
                    )}
                  </div>
                  <ol className="divide-y divide-gray-800/40">
                    {teams.map((team, index) => {
                      const manager = managers.get(team.franchiseID);
                      const isFollowed = team.franchiseID === followed;
                      return (
                        <li key={team.franchiseID}>
                          <button
                            type="button"
                            onClick={() =>
                              setFollowed(isFollowed ? null : team.franchiseID)
                            }
                            aria-pressed={isFollowed}
                            className={clsx(
                              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400',
                              isFollowed
                                ? 'bg-amber-300/10'
                                : 'hover:bg-gray-900/40',
                            )}
                          >
                            <span className="w-5 shrink-0 text-right text-gray-600 tabular-nums">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              <span
                                className={
                                  isFollowed
                                    ? 'font-semibold text-amber-200'
                                    : manager?.steak
                                      ? 'text-emerald-400'
                                      : 'text-gray-300'
                                }
                              >
                                {manager?.name ?? team.franchiseID}
                              </span>
                              {bothLeagues && (
                                <span className="text-gray-600">
                                  {` · ${LEAGUE_NAMES[team.league]}`}
                                </span>
                              )}
                            </span>
                            <span className="w-12 shrink-0 text-right text-gray-400 tabular-nums">
                              <span className="sr-only">Paid </span>
                              {formatDollars(team.spent)}
                            </span>
                            {scored && (
                              <>
                                <span className="w-12 shrink-0 text-right text-gray-500 tabular-nums">
                                  <span className="sr-only">, worth </span>
                                  {formatDollars(team.worth)}
                                </span>
                                <span
                                  className={clsx(
                                    'w-12 shrink-0 text-right font-medium tabular-nums',
                                    valueColor(team.value),
                                  )}
                                >
                                  <span className="sr-only">, value </span>
                                  {formatValue(team.value)}
                                </span>
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <p className="mt-2 text-[11px] sm:text-xs text-gray-600">
                  {scored
                    ? 'What each team spent, what its picks have been worth so far, and the difference. Values net to zero across each league. Tap a team to follow it.'
                    : 'What each team spent at the auction. Tap a team to follow it.'}
                </p>
              </section>
            )}

            {bothLeagues && gaps.length > 0 && (
              <section>
                <SectionLabel>Priced differently</SectionLabel>
                <ol className="rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40">
                  {gaps.map((gap) => (
                    <li
                      key={gap.id}
                      className="flex items-center gap-2.5 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-gray-100">
                            {gap.name}
                          </span>
                          <PositionBadge position={gap.position} />
                        </div>
                        <div className="truncate text-[11px] sm:text-xs text-gray-500">
                          {gap.picks
                            .map(
                              (pick) =>
                                `${LEAGUE_NAMES[pick.league]} ${formatDollars(pick.price)}`,
                            )
                            .join(' · ')}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-gray-300 tabular-nums">
                        {formatDollars(gap.gap)}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] sm:text-xs text-gray-600">
                  Players both leagues bought, priced furthest apart.
                </p>
              </section>
            )}

            <HowItWorks leagues={leagues} week={week} />
          </div>

          <section className="lg:col-span-8 lg:col-start-1">
            <SectionLabel>{`${year} auction · every pick`}</SectionLabel>
            {!scored && (
              <p className="mb-3 text-[11px] sm:text-xs text-gray-600">
                What each pick is worth appears once the first week is in the
                books.
              </p>
            )}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              {scored && (
                <div className="w-40 shrink-0">
                  <SegmentedTabs
                    label="Sort picks"
                    tabs={[
                      { value: 'price', label: 'Price' },
                      { value: 'value', label: 'Value' },
                    ]}
                    value={sort}
                    onChange={(value) =>
                      updateParams({ sort: value === 'value' ? value : null })
                    }
                  />
                </div>
              )}
              <PositionFilters
                value={position}
                onChange={(value) =>
                  updateParams({ pos: value === 'all' ? null : value })
                }
                className="min-w-0 sm:flex-1"
              />
            </div>

            {board.length === 0 ? (
              <p className="rounded-lg border border-gray-800/60 bg-gray-950/30 px-4 py-10 text-center text-sm text-gray-500">
                No picks at this position.
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
                        {followedPicks.length === 0
                          ? ' · no picks here'
                          : ` · ${followedPicks.length} pick${
                              followedPicks.length === 1 ? '' : 's'
                            } · ${formatDollars(
                              followedPicks.reduce(
                                (sum, p) => sum + p.price,
                                0,
                              ),
                            )} paid${
                              scored
                                ? ` · ${formatValue(
                                    followedPicks.reduce(
                                      (sum, p) => sum + (p.value ?? 0),
                                      0,
                                    ),
                                  )}`
                                : ''
                            }`}
                      </span>
                    </span>
                    {followedPicks.length > 0 && (
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
                <ol className="rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40">
                  {listed.slice(0, shown).map((pick) => (
                    <PickRow
                      key={`${pick.league}${pick.id}`}
                      pick={pick}
                      rank={board.indexOf(pick) + 1}
                      {...rowProps}
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
          </section>
        </div>
      )}
    </PageShell>
  );
}

function PickRow({
  pick,
  rank,
  managers,
  followed,
  showLeague,
}: {
  pick: LeaguePick;
  rank: number;
  managers: ReturnType<typeof getTeamManagers>;
  followed: string | null;
  showLeague: boolean;
}) {
  const manager = managers.get(pick.franchiseID);
  const highlighted = pick.franchiseID === followed;
  return (
    <li
      className={clsx(
        'flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-2 transition-colors duration-200',
        highlighted
          ? 'bg-amber-300/10 shadow-[inset_3px_0_0_rgba(252,211,77,0.8)]'
          : followed && 'opacity-60',
      )}
    >
      <span className="w-5 sm:w-6 shrink-0 text-right text-xs sm:text-sm tabular-nums text-gray-600">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-gray-100">
            {pick.name}
          </span>
          <PositionBadge position={pick.position} />
          <span className="shrink-0 text-[10px] sm:text-xs text-gray-600">
            {pick.team}
          </span>
        </div>
        <div className="truncate text-[11px] sm:text-xs text-gray-500">
          <span
            className={
              highlighted
                ? 'font-semibold text-amber-200'
                : manager?.steak
                  ? 'text-emerald-500/80'
                  : undefined
            }
          >
            {manager?.name ?? pick.franchiseID}
          </span>
          {showLeague && ` · ${LEAGUE_NAMES[pick.league]}`}
          {` · ${formatPoints(pick.points)} pts`}
        </div>
      </div>
      {pick.worth === null || pick.value === null ? (
        <span className="shrink-0 text-sm sm:text-base font-medium text-gray-200 tabular-nums">
          {formatDollars(pick.price)}
        </span>
      ) : (
        <div className="shrink-0 text-right">
          <div
            className={clsx(
              'text-sm sm:text-base font-medium leading-tight tabular-nums',
              valueColor(pick.value),
            )}
          >
            {formatValue(pick.value)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-gray-500 tabular-nums">
            <span className="sr-only">Paid </span>
            {formatDollars(pick.price)}
            <span aria-hidden="true"> → </span>
            <span className="sr-only">, worth </span>
            {formatDollars(pick.worth)}
          </div>
        </div>
      )}
    </li>
  );
}

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
        'th');
  return `${n}${suffix}`;
};

// The value formula in plain words, with the shown leagues' own numbers
function HowItWorks({
  leagues,
  week,
}: {
  leagues: DraftLeague[];
  week: number;
}) {
  const example = leagues[0];
  const qb = example?.baselines.find((b) => b.position === 'QB');
  if (!example || !qb) return null;
  const name = LEAGUE_NAMES[example.league];
  const scored = leagues.every((l) => l.pointPrice !== null);
  const baselines = POSITION_FILTERS.filter((f) => f.value !== 'all').filter(
    (f) => leagues.some((l) => l.baselines.some((b) => b.position === f.value)),
  );

  return (
    <section>
      <SectionLabel>How picks are valued</SectionLabel>
      <div className="space-y-3 rounded-lg border border-gray-800/60 bg-gray-950/30 p-3 sm:p-4 text-xs sm:text-sm text-gray-400">
        <p>
          Each pick is priced as if the auction were rerun with everyone knowing
          how the season would go.
          {week > 0 &&
            ` Points count through week ${week}, the last finished week, so no one is a game ahead midweek.`}
        </p>
        <ol className="list-decimal space-y-2 pl-4 marker:text-gray-600">
          <li>
            <span className="font-medium text-gray-200">Baseline.</span>{' '}
            {`${name} drafted ${qb.drafted} QBs, so a QB is measured against the ${ordinal(
              qb.drafted + 1,
            )}-best QB${scored ? ` (${formatPoints(qb.points)} pts)` : ''}: about what a team could have had for nothing. The same goes for every position.`}
          </li>
          <li>
            <span className="font-medium text-gray-200">Price of a point.</span>{' '}
            {`Every roster spot costs at least $1, so of the ${formatDollars(
              example.spent,
            )} ${name} spent, ${formatDollars(
              example.spent - example.picks.length,
            )} was bid on talent. Spread over the points ${name}’s drafted players have scored above their baselines, that ${
              example.pointPrice === null
                ? 'sets the price of a point.'
                : `comes to $${example.pointPrice.toFixed(2)} a point, nudged up a little to cover the picks that scored under their baseline.`
            }`}
          </li>
          <li>
            <span className="font-medium text-gray-200">Worth.</span> $1, plus
            that price for every point above the baseline, and never less than
            $0. A pick’s{' '}
            <span className="font-medium text-gray-200">value</span> is his
            worth less what was paid.
          </li>
        </ol>
        {scored && (
          <table className="w-full text-[11px] sm:text-xs tabular-nums">
            <thead>
              <tr className="text-gray-600">
                <th className="py-1 text-left font-medium">Baseline pts</th>
                {leagues.map((l) => (
                  <th key={l.league} className="py-1 text-right font-medium">
                    {LEAGUE_NAMES[l.league]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baselines.map((filter) => (
                <tr key={filter.value} className="border-t border-gray-800/40">
                  <td className="py-1 text-gray-500">{filter.label}</td>
                  {leagues.map((l) => {
                    const baseline = l.baselines.find(
                      (b) => b.position === filter.value,
                    );
                    return (
                      <td
                        key={l.league}
                        className="py-1 text-right text-gray-300"
                        title={
                          baseline
                            ? `${ordinal(baseline.drafted + 1)}-best ${filter.label}`
                            : undefined
                        }
                      >
                        {baseline ? formatPoints(baseline.points) : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-gray-800/40">
                <td className="py-1 text-gray-500">A point</td>
                {leagues.map((l) => (
                  <td key={l.league} className="py-1 text-right text-gray-300">
                    {l.pointPrice === null
                      ? '–'
                      : `$${l.pointPrice.toFixed(2)}`}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
