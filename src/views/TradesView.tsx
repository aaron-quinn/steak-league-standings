import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import clsx from 'clsx';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import PageShell from '@/components/PageShell';
import FunNav from '@/components/fun/FunNav';
import FollowSelect from '@/components/fun/FollowSelect';
import PositionBadge from '@/components/fun/PositionBadge';
import SegmentedTabs from '@/components/SegmentedTabs';
import SectionLabel from '@/components/SectionLabel';
import { getTrades } from '@/api/fun';
import { useStandingsStore } from '@/stores/standings';
import { getTeamManagers } from '@/utils/steak-teams';
import {
  rankTradeTeams,
  MIN_RATE_DEALS,
  sortTradeTeams,
  tradeKicker,
  tradeNumber,
  tradeTeamRanked,
  tradeVerdict,
  tradeWinRate,
  type TradeTeam,
  type TradeTeamSort,
  TRADE_METRICS,
  FIRST_TRADE_SEASON,
  tradeTeamKey,
  tradeTeamName,
} from '@/utils/trades';
import type { Trade, TradeMetric, TradeSide } from '@/types/Trades';

const LEAGUES = [
  { value: 'all', label: 'Both' },
  { value: 'madison', label: 'Madison' },
  { value: 'la', label: 'LA' },
];
const SORTS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'lopsided', label: 'Most lopsided' },
  { value: 'value', label: 'Most value' },
];
const date = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/Chicago',
});
const TEAM_RANKS: { value: TradeTeamSort; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'average', label: 'Per deal' },
  { value: 'winRate', label: 'Win %' },
];
const kickerTones: Record<string, string> = {
  Fleeced: 'text-amber-300',
  'Clear win': 'text-emerald-400',
  Edge: 'text-emerald-400/80',
  'Coin flip': 'text-sky-300',
  'Win-win': 'text-emerald-400',
  'Lose-lose': 'text-rose-400',
  'Dead even': 'text-gray-400',
};
// Matches SegmentedTabs, so every control in the filter row lines up
const controlHeight = 'h-[30px] sm:h-[38px]';
const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

export default function TradesView() {
  const currentYear = useStandingsStore((s) => s.year);
  const [params, setParams] = useSearchParams();
  const years = useMemo(
    () =>
      Array.from(
        { length: currentYear - FIRST_TRADE_SEASON + 1 },
        (_, i) => currentYear - i,
      ),
    [currentYear],
  );
  const allTime = params.get('season') === 'all';
  const requested = Number(params.get('season'));
  const year = years.includes(requested) ? requested : currentYear;
  const metric: TradeMetric =
    TRADE_METRICS.find((m) => m.value === params.get('metric'))?.value ??
    'lift';
  const league =
    LEAGUES.find((l) => l.value === params.get('league'))?.value ?? 'all';
  const sort =
    SORTS.find((s) => s.value === params.get('sort'))?.value ?? 'lopsided';
  const search = params.get('q') ?? '';
  // A search in the URL keeps the box open on load
  const [searchOpen, setSearchOpen] = useState(Boolean(search));
  const showSearch = searchOpen || Boolean(search);
  const [verdictOpen, setVerdictOpen] = useState(false);
  const onlyFollowed = params.get('team') === '1';
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setParams(next, { replace: true });
  };
  const selectedYears = useMemo(
    () => (allTime ? years : [year]),
    [allTime, years, year],
  );
  const results = useQueries({
    queries: selectedYears.map((season) => ({
      queryKey: ['trades', season, 'kickoff-v4'],
      queryFn: () => getTrades(season),
      staleTime: season < currentYear ? Infinity : 5 * 60 * 1000,
    })),
  });
  const failedYears = selectedYears.filter((_, i) => results[i].isError);
  const loadedYears = selectedYears.filter((_, i) => results[i].data);
  const query = {
    isPending: results.some((result) => result.isPending),
    isError: results.every((result) => result.isError),
    refetch: () =>
      Promise.all(
        results
          .filter((result) => result.isError)
          .map((result) => result.refetch()),
      ),
  };
  const managers = useMemo(
    () =>
      new Map(
        selectedYears.flatMap((season) =>
          [...getTeamManagers(season)].map(
            ([id, manager]) => [`${season}:${id}`, manager] as const,
          ),
        ),
      ),
    [selectedYears],
  );
  const trades = results
    .flatMap((result) => result.data?.trades ?? [])
    .filter((t) => league === 'all' || t.league === league);
  const teams = rankTradeTeams(trades, metric, managers, allTime);
  const rankBy =
    TEAM_RANKS.find((r) => r.value === params.get('rank'))?.value ?? 'total';
  const rankedTeams = sortTradeTeams(teams, rankBy);
  const nameOf = (id: string) =>
    teams.find((team) => team.id === id)?.name ?? id;
  const teamKey = (trade: Trade, id: string) =>
    tradeTeamKey(trade, id, managers, allTime);
  const followed =
    teams.find((t) => t.name === params.get('follow'))?.id ?? null;
  const listed = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = trades.filter(
      (t) =>
        (!onlyFollowed ||
          !followed ||
          t.sides.some(
            (s) =>
              tradeTeamKey(t, s.franchiseID, managers, allTime) === followed,
          )) &&
        words.every((word) =>
          t.sides.some((s) =>
            `${tradeTeamName(t, s.franchiseID, managers)} ${s.received.map((p) => p.name).join(' ')}`
              .toLowerCase()
              .includes(word),
          ),
        ),
    );
    const value = (t: Trade) =>
      t.sides.reduce((n, s) => n + (s[metric] ?? 0), 0);
    const gap = (t: Trade) =>
      Math.abs((t.sides[0][metric] ?? 0) - (t.sides[1][metric] ?? 0));
    return matches.sort((a, b) =>
      sort === 'recent'
        ? b.time - a.time
        : Number(
            ['pending', 'unrated'].includes(tradeVerdict(a, metric).kind),
          ) -
            Number(
              ['pending', 'unrated'].includes(tradeVerdict(b, metric).kind),
            ) ||
          (sort === 'lopsided' ? gap(b) - gap(a) : value(b) - value(a)) ||
          b.time - a.time,
    );
  }, [trades, metric, managers, search, sort, followed, onlyFollowed, allTime]);

  return (
    <PageShell>
      <FunNav />
      {/* Every list filter on one row on desktop; wraps on smaller screens */}
      <div className="mb-3 flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <div className="w-48 shrink-0">
          <SegmentedTabs
            label="League"
            tabs={LEAGUES}
            value={league}
            onChange={(v) => update({ league: v === 'all' ? null : v })}
          />
        </div>
        <div className="w-full shrink-0 sm:w-80">
          <SegmentedTabs
            label="Trade valuation"
            tabs={TRADE_METRICS}
            value={metric}
            onChange={(v) => update({ metric: v === 'lift' ? null : v })}
          />
        </div>
        <select
          aria-label="Sort trades"
          value={sort}
          onChange={(e) => update({ sort: e.target.value })}
          className={clsx(
            'shrink-0 rounded-md border-gray-800 bg-gray-950 py-0 pl-2 pr-8 text-xs text-gray-200 focus:border-emerald-400 focus:ring-emerald-400 sm:text-sm',
            controlHeight,
          )}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <FollowSelect
          options={teams}
          value={followed}
          onChange={(id) =>
            update({ follow: id ? nameOf(id) : null, team: null })
          }
          className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1 sm:justify-end [&_button]:h-[30px] [&_button]:w-[30px] [&_select]:h-[30px] [&_select]:py-0 sm:[&_button]:h-[38px] sm:[&_button]:w-[38px] sm:[&_select]:h-[38px]"
        />
        <label className="flex shrink-0 items-center gap-2 text-xs text-gray-500 sm:text-sm">
          Season
          <select
            aria-label="Season"
            value={allTime ? 'all' : year}
            onChange={(e) => update({ season: e.target.value, team: null })}
            className={clsx(
              'rounded-md border-gray-800 bg-gray-950 py-0 pl-2 pr-8 text-xs text-gray-200 focus:border-emerald-400 focus:ring-emerald-400 sm:text-sm',
              controlHeight,
            )}
          >
            <option value="all">All time</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label="Search trades"
          aria-expanded={showSearch}
          onClick={() => {
            if (showSearch) {
              setSearchOpen(false);
              update({ q: null });
            } else setSearchOpen(true);
          }}
          className={clsx(
            'flex aspect-square shrink-0 items-center justify-center rounded-md border',
            controlHeight,
            showSearch
              ? 'border-emerald-400/60 text-emerald-300'
              : 'border-gray-800 text-gray-400 hover:text-gray-200',
            focus,
          )}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" />
          </svg>
        </button>
      </div>
      {showSearch ? (
        <input
          type="search"
          aria-label="Search trades"
          placeholder="Search a player or manager…"
          autoFocus
          value={search}
          onChange={(e) => update({ q: e.target.value || null })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearchOpen(false);
              update({ q: null });
            }
          }}
          className="mb-3 w-full rounded-md border border-gray-800 bg-gray-950 px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:border-emerald-400 focus:ring-emerald-400"
        />
      ) : null}

      <div className="mb-4">
        <p className="text-xs leading-relaxed text-gray-500">
          {TRADE_METRICS.find((m) => m.value === metric)?.description}{' '}
          <button
            type="button"
            aria-expanded={verdictOpen}
            aria-controls="verdict-help"
            onClick={() => setVerdictOpen((o) => !o)}
            className={clsx(
              'whitespace-nowrap rounded text-gray-400 hover:text-gray-200',
              focus,
            )}
          >
            How the verdict works{' '}
            <span
              aria-hidden="true"
              className={clsx(
                'inline-block transition-transform duration-150 motion-reduce:transition-none',
                verdictOpen && 'rotate-90',
              )}
            >
              ›
            </span>
          </button>
        </p>
        <div
          id="verdict-help"
          hidden={!verdictOpen}
          className="text-xs leading-relaxed text-gray-500"
        >
          <div className="mt-3 max-w-3xl space-y-2 border-l border-gray-700 pl-4">
            <p>
              <strong className="text-gray-300">Lineup lift:</strong> each week,
              optimize the team’s actual roster under its league’s position and
              flex limits. Then remove the still-held received players, restore
              the players sent away, and optimize again. The difference is the
              trade’s lineup lift. Each side uses its own roster, so both can
              gain or both can lose.
            </p>
            <p>
              <strong className="text-gray-300">Production views:</strong> add
              the points scored by acquired players on their new team. Started
              points counts only actual starts; roster points includes the
              bench. These measure the haul, not profit over what was given up.
            </p>
            <p>
              All views count a player’s game only when its kickoff comes after
              the trade and before he is dropped or traded again. Only observed
              weekly rosters count; taxi weeks add no production. Lineup lift is
              evaluated in weeks with at least one received player on the
              roster.
            </p>
            <p>
              This is hindsight lineup potential, not points actually added to
              the standings. It holds other roster moves fixed, does not model
              replacement signings or later trade chains, and may attribute
              overlapping lineup improvements to separate trades. Trade totals
              are independent estimates.
            </p>
            <p>
              The side with more value wins; ties within 0.01 points are even.
              “Both gained” is separate from the winner. A side with no rostered
              acquired players earns zero lift once scored weeks exist. Missing
              scores, unknown players, and non-player assets leave the trade
              unrated. Unrated and unscored trades are excluded from ranked
              value.
            </p>
            <p>
              Team rankings add each team’s own value, with wins as a
              tiebreaker. The per-trade average provides a check on teams that
              simply trade more. All values use the selected season and league’s
              scoring.
            </p>
          </div>
        </div>
      </div>

      {!query.isPending && !query.isError && failedYears.length ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-xs text-amber-200"
        >
          Showing {loadedYears.length} of {selectedYears.length} seasons. Unable
          to load {failedYears.join(', ')}; those seasons are excluded from
          these totals.
          <button
            type="button"
            onClick={() => query.refetch()}
            className={clsx('ml-2 rounded underline underline-offset-2', focus)}
          >
            Retry missing seasons
          </button>
        </div>
      ) : null}
      {query.isError ? (
        <div
          role="alert"
          className="rounded-lg border border-gray-800 p-6 text-center"
        >
          <h2 className="font-semibold text-gray-100">Trades unavailable</h2>
          <p className="mt-2 text-sm text-gray-400">
            We couldn’t load{' '}
            {allTime ? 'the trade history' : 'this season’s trades'}.
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className={clsx(
              'mt-4 rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-200',
              focus,
            )}
          >
            Try again
          </button>
        </div>
      ) : query.isPending ? (
        <div role="status" className="space-y-3">
          <p className="text-xs text-gray-500">
            {allTime
              ? `Loading trade history · ${loadedYears.length} of ${selectedYears.length} seasons`
              : 'Loading trades…'}
          </p>
          {[0, 1, 2].map((n) => (
            <div
              key={n}
              className="h-32 animate-pulse rounded-lg border border-gray-800 bg-gray-950 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : !trades.length ? (
        <div className="rounded-lg border border-dashed border-gray-800 px-6 py-12 text-center">
          <div className="text-3xl text-emerald-400" aria-hidden="true">
            ⇄
          </div>
          <h2 className="mt-3 font-semibold text-gray-200">
            The trade desk is quiet.
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            No accepted trades in{' '}
            {league === 'all'
              ? 'either league'
              : league === 'la'
                ? 'LA'
                : 'Madison'}{' '}
            {allTime
              ? `across ${FIRST_TRADE_SEASON}–${currentYear}`
              : `for ${year}`}
            . Try another season.
          </p>
        </div>
      ) : (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-labelledby="trade-ledger">
              <h2 id="trade-ledger" className="sr-only">
                Trade ledger
              </h2>
              {followed ? (
                <label className="mb-3 flex items-center gap-2 text-xs text-amber-200">
                  <input
                    type="checkbox"
                    checked={onlyFollowed}
                    onChange={(e) =>
                      update({ team: e.target.checked ? '1' : null })
                    }
                    className="rounded border-gray-700 bg-gray-950 text-emerald-500 focus:ring-emerald-400"
                  />
                  Only {nameOf(followed)}’s trades
                </label>
              ) : null}
              <div className="space-y-3">
                {listed.map((trade) => (
                  <TradeCard
                    key={`${trade.season}:${trade.id}`}
                    trade={trade}
                    metric={metric}
                    nameOf={(id) => tradeTeamName(trade, id, managers)}
                    followed={
                      trade.sides.find(
                        (side) => teamKey(trade, side.franchiseID) === followed,
                      )?.franchiseID ?? null
                    }
                    showSeason={allTime}
                  />
                ))}
              </div>
              {!listed.length ? (
                <p className="rounded-lg border border-gray-800 p-8 text-center text-sm text-gray-500">
                  No trades match these filters.
                </p>
              ) : null}
            </section>
            <section
              aria-labelledby="trade-rankings"
              className="lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col"
            >
              <h2 id="trade-rankings" className="sr-only">
                Team totals
              </h2>
              <SectionLabel tone="green">Team totals</SectionLabel>
              <div className="mb-2 shrink-0">
                <SegmentedTabs
                  label="Rank teams by"
                  tabs={TEAM_RANKS}
                  value={rankBy}
                  onChange={(v) => update({ rank: v === 'total' ? null : v })}
                />
              </div>
              {/* Taller than the window, the list scrolls inside the sticky
                  sidebar so its bottom stays reachable */}
              <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-950/40">
                <div className="overflow-y-auto overscroll-contain">
                  {rankedTeams.map((team, i) => (
                    <button
                      key={team.id}
                      type="button"
                      aria-pressed={team.id === followed}
                      onClick={() =>
                        update({
                          follow: team.id === followed ? null : team.name,
                          team: null,
                        })
                      }
                      className={clsx(
                        'flex w-full items-center gap-3 border-b border-gray-800/60 px-3 py-2.5 text-left last:border-0 hover:bg-gray-900/60',
                        focus,
                        team.id === followed && 'bg-amber-300/5',
                      )}
                    >
                      <span
                        className={clsx(
                          'w-5 shrink-0 font-mono text-sm',
                          i === 0 && tradeTeamRanked(team, rankBy)
                            ? 'text-emerald-400'
                            : 'text-gray-600',
                        )}
                      >
                        {tradeTeamRanked(team, rankBy) ? i + 1 : '—'}
                      </span>
                      <TeamTotal
                        team={team}
                        rankBy={rankBy}
                        signed={metric === 'lift'}
                        followed={team.id === followed}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-3 shrink-0 text-[11px] leading-relaxed text-gray-500">
                {rankBy === 'winRate'
                  ? 'Ranked by share of rated deals won.'
                  : `Ranked by ${rankBy === 'average' ? 'average' : 'total'} ${
                      metric === 'lift'
                        ? 'lineup lift'
                        : metric === 'started'
                          ? 'started points'
                          : 'roster points'
                    }${rankBy === 'average' ? ' per rated deal' : ''}.`}
                {rankBy !== 'total'
                  ? ` Teams need ${MIN_RATE_DEALS} rated deals to be ranked.`
                  : ''}{' '}
                Tap a team to follow its deals. Rankings cover all trades in the
                selected league and seasons, regardless of search.
              </p>
            </section>
          </div>
        </>
      )}
    </PageShell>
  );
}

function TradeCard({
  trade,
  metric,
  nameOf,
  followed,
  showSeason,
}: {
  trade: Trade;
  metric: TradeMetric;
  nameOf: (id: string) => string;
  followed: string | null;
  showSeason: boolean;
}) {
  const [open, setOpen] = useState(false);
  const verdict = tradeVerdict(trade, metric);
  const [a, b] = trade.sides;
  const signed = metric === 'lift';
  const rated = verdict.kind !== 'unrated' && verdict.kind !== 'pending';
  const gap = rated ? Math.abs((a[metric] ?? 0) - (b[metric] ?? 0)) : null;
  // The winner reads first
  const sides = verdict.winner === b.franchiseID ? [b, a] : [a, b];
  const kicker = tradeKicker(trade, metric);
  const name = (id: string) => (
    <span className={id === followed ? 'text-amber-200' : undefined}>
      {nameOf(id)}
    </span>
  );
  return (
    <article
      className={clsx(
        'rounded-lg border bg-gray-950/30 p-3 sm:p-4',
        trade.sides.some((s) => s.franchiseID === followed)
          ? 'border-amber-300/50'
          : 'border-gray-800',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <p
          className={clsx(
            'text-[11px] font-semibold uppercase tracking-widest',
            kickerTones[kicker] ?? 'text-gray-500',
          )}
        >
          {kicker}
        </p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={clsx(
            'flex shrink-0 items-center gap-1 rounded text-xs text-gray-400 hover:text-gray-100',
            focus,
          )}
        >
          Week by week
          <span
            aria-hidden="true"
            className={clsx(
              'inline-block transition-transform duration-150 motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          >
            ›
          </span>
        </button>
      </div>
      <h3 className="text-base font-semibold text-gray-100">
        {verdict.winner ? (
          <>
            {name(verdict.winner)} won by{' '}
            <span className="font-mono text-emerald-300">
              {tradeNumber(gap)}
            </span>
          </>
        ) : rated ? (
          'Even trade'
        ) : verdict.kind === 'pending' ? (
          'No scored weeks yet'
        ) : (
          'Not enough data to rate'
        )}
      </h3>
      <div className="mt-0.5 text-xs text-gray-500">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1">
          {verdict.winner ? (
            <span>over {name(sides[1].franchiseID)} ·</span>
          ) : null}
          {/* When and where, with the details a tap away */}
          <Popover className="relative">
            <PopoverButton
              className={clsx(
                'flex items-center gap-1 rounded text-gray-500 hover:text-gray-200 data-[open]:text-gray-200',
                focus,
              )}
            >
              {showSeason ? `${trade.season} · ` : ''}
              {trade.week === null ? 'Offseason' : `Week ${trade.week}`}
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 7.25v3.5" strokeLinecap="round" />
                <circle cx="8" cy="5" r="0.5" fill="currentColor" />
              </svg>
              <span className="sr-only">Trade details</span>
            </PopoverButton>
            <PopoverPanel
              anchor={{ to: 'bottom start', gap: 6 }}
              className="z-50 w-max max-w-[16rem] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300 shadow-xl"
            >
              <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1">
                <dt className="text-gray-500">Traded</dt>
                <dd>{date.format(trade.time)}</dd>
                <dt className="text-gray-500">League</dt>
                <dd>{trade.league === 'la' ? 'LA' : 'Madison'}</dd>
              </dl>
            </PopoverPanel>
          </Popover>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        {sides.map((side) => (
          <SideGot
            key={side.franchiseID}
            side={side}
            name={nameOf(side.franchiseID)}
            metric={metric}
            rated={rated}
            followed={side.franchiseID === followed}
          />
        ))}
      </div>
      {open ? (
        <div className="mt-3 text-[11px] text-gray-500">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sides.map((side) => (
              <div key={side.franchiseID}>
                <h4 className="mb-2 font-medium text-gray-300">
                  {nameOf(side.franchiseID)}
                </h4>
                {signed ? (
                  <table className="w-full text-right font-mono">
                    <caption className="sr-only">
                      Weekly lineup comparison for {nameOf(side.franchiseID)}
                    </caption>
                    <thead className="text-[10px] text-gray-500">
                      <tr>
                        <th className="py-1 text-left">Week</th>
                        <th>With</th>
                        <th>Kept</th>
                        <th>Lift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {side.impact.map((g) => (
                        <tr
                          key={g.week}
                          className="border-t border-gray-800/60"
                        >
                          <td className="py-1 text-left">W{g.week}</td>
                          <td>{tradeNumber(g.withTrade)}</td>
                          <td>{tradeNumber(g.withoutTrade)}</td>
                          <td
                            className={
                              g.lift !== null && g.lift > 0
                                ? 'text-emerald-300'
                                : 'text-gray-400'
                            }
                          >
                            {tradeNumber(g.lift, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  side.received.map((p) => (
                    <div key={p.id} className="mb-2">
                      <p className="text-gray-400">{p.name}</p>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed">
                        {p.games.length
                          ? p.games
                              .map(
                                (g) =>
                                  `W${g.week}: ${tradeNumber(metric === 'started' && !g.starter ? 0 : g.score)}${g.starter ? '' : ' (bench)'}`,
                              )
                              .join(' · ')
                          : 'No rostered weeks yet'}
                      </p>
                    </div>
                  ))
                )}
                {signed && !side.impact.length ? (
                  <p>No rostered weeks to compare yet.</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

const valueTone = (v: number | null) =>
  v === null
    ? 'text-gray-500'
    : v > 0
      ? 'text-emerald-300'
      : v < 0
        ? 'text-rose-300'
        : 'text-gray-400';

// A team's row in the sidebar: the stat it's ranked by up front, its trade
// record and win rate underneath
function TeamTotal({
  team,
  rankBy,
  signed,
  followed,
}: {
  team: TradeTeam;
  rankBy: TradeTeamSort;
  signed: boolean;
  followed: boolean;
}) {
  const rate = tradeWinRate(team);
  const percent = rate === null ? null : `${Math.round(rate * 100)}%`;
  const total = team.rated ? team.value : null;
  const average = team.rated ? team.value / team.rated : null;
  const ties = team.rated - team.wins - team.losses;
  const [primary, tone] =
    rankBy === 'winRate'
      ? [percent ?? '—', rate === null ? 'text-gray-500' : 'text-gray-100']
      : rankBy === 'average'
        ? [tradeNumber(average, signed), valueTone(average)]
        : [tradeNumber(total, signed), valueTone(total)];
  const unrated = team.trades - team.rated;
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <div className="min-w-0">
        <p
          className={clsx(
            'truncate text-sm font-medium',
            followed ? 'text-amber-200' : 'text-gray-200',
          )}
        >
          {team.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-gray-500">
          <span className="font-mono text-gray-300">
            {team.wins}–{team.losses}
            {ties ? `–${ties}` : ''}
          </span>
          {rankBy !== 'winRate' && percent ? ` · ${percent} won` : ''}
          {unrated ? ` · ${unrated} unrated` : ''}
        </p>
      </div>
      <span className={clsx('shrink-0 font-mono text-sm', tone)}>
        {primary}
      </span>
    </div>
  );
}

// One team's side of a deal: what they got and what it was worth
function SideGot({
  side,
  name,
  metric,
  rated,
  followed,
}: {
  side: TradeSide;
  name: string;
  metric: TradeMetric;
  rated: boolean;
  followed: boolean;
}) {
  const value = metric === 'lift' && !rated ? null : side[metric];
  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px] text-gray-500">
        <span className={clsx('truncate', followed && 'text-amber-200')}>
          {name} got
        </span>
        <span
          className={clsx(
            'shrink-0 font-mono text-xs',
            rated && value !== null && value > 0
              ? 'text-emerald-300'
              : rated && value !== null && value < 0
                ? 'text-rose-300'
                : 'text-gray-500',
          )}
        >
          {tradeNumber(value, metric === 'lift')}
        </span>
      </p>
      <ul className="space-y-1 text-xs text-gray-300">
        {side.received.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <PositionBadge position={p.position} />
            <span className="min-w-0 truncate">{p.name}</span>
            {metric !== 'lift' ? (
              <span className="ml-auto pl-1 font-mono text-[11px] text-gray-500">
                {tradeNumber(p[metric])}
              </span>
            ) : null}
          </li>
        ))}
        {!side.received.length ? (
          <li className="text-gray-500">No players received</li>
        ) : null}
      </ul>
    </div>
  );
}
