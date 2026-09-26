import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import SectionLabel from '@/components/SectionLabel';
import MatchupsPlaceholder from '@/components/MatchupsPlaceholder';
import FunNav from '@/components/fun/FunNav';
import FollowSelect from '@/components/fun/FollowSelect';
import TombstonePit, {
  TombstoneNuggets,
  hasSelfBuyer,
} from '@/components/fun/TombstonePit';
import { zoneText } from '@/components/fun/zone-colors';
import { getWeeklyScores } from '@/api/fun';
import { useStandingsStore } from '@/stores/standings';
import type { WeeklyScores } from '@/types/Fun';
import {
  buildSteakSeason,
  type RaceTeam,
  type SteakSeason,
} from '@/utils/steak-season';
import { getSteakLine, getSteakZone } from '@/utils/steak-teams';
import {
  fitScoringModel,
  getDeficits,
  getTombstoneLine,
  getWeekComebacks,
  isTombstoned,
  simulateSteakOdds,
  weeksInSeason,
  type ChaseTarget,
  type Comeback,
  type SteakOdds,
} from '@/utils/steak-odds';

// Seasons with both leagues in the managers data
const FIRST_SEASON = 2016;

// Kept outside the component so the combined data only changes when a
// season's scores do
function combineSeasons(results: UseQueryResult<WeeklyScores[]>[]) {
  return {
    data: results.map((result) => result.data),
    isError: results.some((result) => result.isError),
    isPending: results.some((result) => result.isPending),
  };
}

const ordinal = (n: number) => {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
        'th');
  return `${n}${suffix}`;
};

// "2021–2025", or "2021–2023 and 2025" around a gap
function formatYears(years: number[]) {
  const runs: number[][] = [];
  years.forEach((year) => {
    const run = runs[runs.length - 1];
    if (run && year === run[run.length - 1] + 1) run.push(year);
    else runs.push([year]);
  });
  const parts = runs.map((run) =>
    run.length > 1 ? `${run[0]}–${run[run.length - 1]}` : `${run[0]}`,
  );
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0];
}

// Whole percents, without claiming a certainty the simulation can't show
function formatChance(chance: number, settled: boolean) {
  if (!settled && chance > 0.995) return '>99%';
  if (!settled && chance < 0.005) return '<1%';
  return `${Math.round(chance * 100)}%`;
}

interface Outlook {
  team: RaceTeam;
  rank: number;
  // Points clear of the first team out when eating, otherwise points behind
  // the last eater as a negative
  margin: number;
  odds: SteakOdds;
  // Change in the chance of eating since the week before
  change: number;
  tombstoned: boolean;
  // First week of the current stretch in the graveyard
  buriedSince: number | null;
  // The last week in the graveyard, for a team that has climbed back out
  risen: number | null;
  // Where the team ended up, once its season is over
  finish: number | null;
}

// Weeks come back from the API as 1, 2, 3…, so a count of played weeks is
// also the number of the latest one
function buildRows(
  season: SteakSeason,
  played: number,
  line: (Comeback | null)[],
  seasonWeeks: number,
  odds: Map<string, SteakOdds>,
  before: Map<string, SteakOdds>,
): Outlook[] {
  const { eaters } = getSteakLine(season.teams.length);
  const byWeek = Array.from({ length: played }, (_, i) =>
    getDeficits(season, i + 1),
  );
  const buried = (id: string, week: number) =>
    isTombstoned(byWeek[week - 1].get(id) ?? 0, week, line, seasonWeeks);
  const firstOut = season.teams
    .map((team) => team.totals[played - 1])
    .sort((a, b) => b - a)[eaters];
  const complete = season.weeks.length >= seasonWeeks;

  return [...season.teams]
    .sort((a, b) => a.ranks[played - 1] - b.ranks[played - 1])
    .map((team) => {
      const rank = team.ranks[played - 1];
      const tombstoned = buried(team.id, played);
      let since = played;
      while (tombstoned && since > 1 && buried(team.id, since - 1)) since--;
      let risen: number | null = null;
      for (let week = played - 1; !tombstoned && week >= 1; week--) {
        if (buried(team.id, week)) {
          risen = week;
          break;
        }
      }
      const teamOdds = odds.get(team.id)!;
      return {
        team,
        rank,
        margin:
          rank <= eaters
            ? team.totals[played - 1] - firstOut
            : -(byWeek[played - 1].get(team.id) ?? 0),
        odds: teamOdds,
        change: teamOdds.eater - before.get(team.id)!.eater,
        tombstoned,
        buriedSince: tombstoned ? since : null,
        risen,
        finish: complete ? team.ranks[team.ranks.length - 1] : null,
      };
    });
}

export default function SteakOddsView() {
  const currentYear = useStandingsStore((state) => state.year);
  const [searchParams, setSearchParams] = useSearchParams();

  const seasons = Array.from(
    { length: currentYear - FIRST_SEASON + 1 },
    (_, i) => currentYear - i,
  );
  const requestedSeason = Number(searchParams.get('season'));
  const year = seasons.includes(requestedSeason)
    ? requestedSeason
    : currentYear;

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    setSearchParams(next, { replace: true });
  };

  // Every season's scores: the one on screen, and the rest to learn from
  const { data, isError, isPending } = useQueries({
    queries: seasons.map((season) => ({
      queryKey: ['weekly-scores', season],
      queryFn: () => getWeeklyScores(season),
    })),
    combine: combineSeasons,
  });

  // The model and graveyard come from every finished season except the one
  // on screen, so a past season is judged as if it hadn't happened yet
  const board = useMemo(() => {
    const scores = (season: number) =>
      data[currentYear - season] as WeeklyScores[];
    if (data.some((weeks) => !weeks)) return null;
    const pastYears = Array.from(
      { length: currentYear - FIRST_SEASON },
      (_, i) => FIRST_SEASON + i,
    ).filter((season) => season !== year);
    const model = {
      ...fitScoringModel(pastYears.map(scores)),
      // Played out to the on-screen season's length, not the longest past one
      seasonWeeks: weeksInSeason(year),
    };
    const history = pastYears.map((season) => ({
      year: season,
      season: buildSteakSeason(season, scores(season)),
    }));
    const weekComebacks = getWeekComebacks(history, model.seasonWeeks);
    return {
      pastYears,
      model,
      history,
      weekComebacks,
      line: getTombstoneLine(weekComebacks),
      season: buildSteakSeason(year, scores(year)),
    };
  }, [data, year, currentYear]);

  const weeksPlayed = board?.season.weeks.length ?? 0;
  const requestedWeek = Number(searchParams.get('week'));
  const played =
    requestedWeek >= 1 && requestedWeek <= weeksPlayed
      ? requestedWeek
      : weeksPlayed;
  const setPlayed = (week: number) =>
    updateParams({ week: week === weeksPlayed ? null : String(week) });

  const odds = useMemo(
    () =>
      board && played > 0
        ? simulateSteakOdds(board.season, played, board.model)
        : null,
    [board, played],
  );
  const before = useMemo(
    () =>
      board && played > 0
        ? simulateSteakOdds(board.season, played - 1, board.model)
        : null,
    [board, played],
  );
  const rows = useMemo(
    () =>
      board && odds && before
        ? buildRows(
            board.season,
            played,
            board.line,
            board.model.seasonWeeks,
            odds,
            before,
          )
        : [],
    [board, played, odds, before],
  );

  // Followed by manager name, shared with the other Fun screens
  const followName = searchParams.get('follow');
  const selected =
    board?.season.teams.find((team) => team.name === followName)?.id ?? null;
  const setSelected = (id: string | null) =>
    updateParams({
      follow: board?.season.teams.find((team) => team.id === id)?.name ?? null,
    });

  const alive = rows.filter((row) => !row.tombstoned);
  const buried = rows.filter((row) => row.tombstoned);
  const seasonWeeks = board?.model.seasonWeeks ?? 0;
  const settled = played >= seasonWeeks;
  const record = board?.line[played] ?? null;

  // The line the pit and its nuggets measure from. A season without a
  // self-buyer only has the steak line.
  const [chosenTarget, setChosenTarget] = useState<ChaseTarget>('eater');
  const target: ChaseTarget =
    board && hasSelfBuyer(board.season) ? chosenTarget : 'eater';
  const chase = board && {
    target,
    seasonWeeks,
    season: board.season,
    history: board.history,
    played,
  };

  return (
    <PageShell>
      <FunNav />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <WeekStepper
          label={
            !board
              ? '–'
              : weeksPlayed === 0
                ? 'Preseason'
                : settled
                  ? 'Final'
                  : `After week ${played}`
          }
          played={played}
          weeksPlayed={weeksPlayed}
          onChange={setPlayed}
        />
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
                // Weeks don't carry over between seasons
                week: null,
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
          options={board?.season.teams ?? []}
          value={selected}
          onChange={setSelected}
          className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:justify-end"
        />
      </div>

      {isError ? (
        <MatchupsPlaceholder
          title="Steak Odds Unavailable"
          message="We were unable to load the league’s history. Please try again later."
        />
      ) : isPending || !board ? (
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-x-12"
          role="status"
          aria-label="Loading"
        >
          <div className="lg:col-span-8 space-y-1.5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-gray-950/60"
              />
            ))}
          </div>
          <div className="lg:col-span-4 h-48 animate-pulse rounded-lg bg-gray-950/60" />
          <div className="lg:col-span-12 h-72 animate-pulse rounded-lg bg-gray-950/60" />
        </div>
      ) : played === 0 ? (
        <MatchupsPlaceholder
          title="No Weeks Played Yet"
          message="The odds start moving once the first week of the season is in the books."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-x-12">
          <section className="lg:col-span-8">
            <SectionLabel tone="green">
              {`${year} Steak Odds · ${settled ? 'Final' : `After Week ${played}`}`}
            </SectionLabel>

            <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[10px] sm:text-[11px] text-gray-500">
              <div className="flex items-center gap-3">
                <ZoneKey className="bg-emerald-400/80">Eat</ZoneKey>
                <ZoneKey className="bg-gray-500">Self-buy</ZoneKey>
                <ZoneKey className="bg-red-400/70">Buy</ZoneKey>
              </div>
              {!settled && (
                <span>
                  {played === 1
                    ? 'Change since preseason'
                    : 'Change since last week'}
                </span>
              )}
            </div>

            {alive.length > 0 && (
              <ol className="rounded-lg border border-gray-800/60 bg-gray-950/30 divide-y divide-gray-800/40">
                {alive.map((row) => (
                  <OddsRow
                    key={row.team.id}
                    row={row}
                    teamCount={rows.length}
                    settled={settled}
                    followed={selected}
                    onSelect={setSelected}
                  />
                ))}
              </ol>
            )}

            {buried.length > 0 && record && (
              <Graveyard
                rows={buried}
                teamCount={rows.length}
                record={record}
                played={played}
                followed={selected}
                onSelect={setSelected}
              />
            )}

            <p className="mt-2 text-[11px] sm:text-xs text-gray-600">
              {settled
                ? 'Final steak standings.'
                : `Chances from playing out the last ${seasonWeeks - played} week${seasonWeeks - played === 1 ? '' : 's'} 10,000 times. Tap a team to follow it.`}
            </p>
          </section>

          {/* Down by the legend row's height, so the first nugget lines up
              with the top of the list */}
          <aside className="lg:col-span-4 space-y-6 lg:pt-6">
            {chase && !settled && (
              <div>
                <SectionLabel>
                  {`Nuggets · ${target === 'eater' ? 'Steak line' : 'Self-buyer line'}`}
                </SectionLabel>
                <TombstoneNuggets {...chase} />
              </div>
            )}

            <div>
              <SectionLabel>How the odds work</SectionLabel>
              <div className="space-y-2 rounded-lg border border-gray-800/60 bg-gray-950/30 px-3 py-2.5 text-[11px] sm:text-xs leading-relaxed text-gray-400">
                <p>
                  Each run plays out the rest of the season for every team and
                  sorts the final totals into eaters, the self-buyer and buyers.
                </p>
                <p>
                  A team’s weekly score typically lands about{' '}
                  <span className="font-mono text-gray-200">
                    {Math.round(board.model.weeklySpread)}
                  </span>{' '}
                  points above or below its level. That level is its scoring so
                  far, pulled toward the league average, because hot starts
                  mostly cool off: a team’s own average only counts for half
                  after{' '}
                  <span className="font-mono text-gray-200">
                    {Math.round(board.model.priorWeeks)}
                  </span>{' '}
                  weeks.
                </p>
                <p>
                  Both numbers, and the tombstone line, come from the{' '}
                  {formatYears(board.pastYears)} seasons. A team further behind
                  the last eater than anyone who came back to eat, at that point
                  of the season or later, is tombstoned.
                  {year < currentYear &&
                    ` ${year} is left out of its own odds, so its teams could still break the record.`}
                </p>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-12">
            <SectionLabel>The Tombstone Line</SectionLabel>
            {chase && (
              <TombstonePit
                {...chase}
                onTargetChange={setChosenTarget}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}

function WeekStepper({
  label,
  played,
  weeksPlayed,
  onChange,
}: {
  label: string;
  played: number;
  weeksPlayed: number;
  onChange: (week: number) => void;
}) {
  const button =
    'flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
  return (
    <div className="flex items-center rounded-lg border border-gray-800 bg-gray-950 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <button
        type="button"
        aria-label="Previous week"
        disabled={played <= 1}
        onClick={() => onChange(played - 1)}
        className={button}
      >
        <Chevron direction="left" />
      </button>
      <span
        aria-live="polite"
        className="min-w-[6.5rem] px-1 text-center text-xs sm:text-sm font-medium text-gray-200 tabular-nums"
      >
        {label}
      </span>
      <button
        type="button"
        aria-label="Next week"
        disabled={played >= weeksPlayed}
        onClick={() => onChange(played + 1)}
        className={button}
      >
        <Chevron direction="right" />
      </button>
    </div>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
    </svg>
  );
}

function ZoneKey({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={clsx('h-2 w-2 shrink-0 rounded-sm', className)}
      />
      {children}
    </span>
  );
}

// Eat, self-buy and buy chances side by side, split by a sliver of page
function OddsBar({ odds, className }: { odds: SteakOdds; className?: string }) {
  const segments = [
    { chance: odds.eater, className: 'bg-emerald-400/80' },
    { chance: odds['self-buyer'], className: 'bg-gray-500' },
    { chance: odds.buyer, className: 'bg-red-400/70' },
  ];
  return (
    <div
      aria-hidden="true"
      className={clsx('flex h-2 gap-0.5 overflow-hidden rounded', className)}
    >
      {segments.map((segment, i) => (
        <span
          key={i}
          className={clsx(
            'h-full basis-0 rounded-sm transition-[flex-grow] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
            segment.className,
            // A sliver too small to see would still leave a gap
            segment.chance < 0.005 && 'hidden',
          )}
          style={{ flexGrow: segment.chance }}
        />
      ))}
    </div>
  );
}

function Change({ change, settled }: { change: number; settled: boolean }) {
  const points = Math.round(change * 100);
  if (settled) return null;
  return (
    <span
      className={clsx(
        'font-mono text-[10px] sm:text-xs tabular-nums',
        points > 0
          ? 'text-emerald-400'
          : points < 0
            ? 'text-red-400'
            : 'text-gray-700',
      )}
    >
      {points > 0 ? `▲${points}` : points < 0 ? `▼${-points}` : '–'}
    </span>
  );
}

function OddsRow({
  row,
  teamCount,
  settled,
  followed,
  onSelect,
}: {
  row: Outlook;
  teamCount: number;
  settled: boolean;
  followed: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { team, rank, margin, odds, change, risen, finish } = row;
  const isFollowed = team.id === followed;
  const ate = finish !== null && getSteakZone(finish, teamCount) === 'eater';

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(isFollowed ? null : team.id)}
        aria-pressed={isFollowed}
        className={clsx(
          'grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 px-2.5 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 sm:grid-cols-[1.5rem_minmax(0,11rem)_minmax(0,1fr)_3rem_2.75rem_2.75rem_2.25rem] sm:gap-x-3 sm:px-3',
          isFollowed
            ? 'bg-amber-300/10 shadow-[inset_3px_0_0_rgba(252,211,77,0.8)]'
            : 'hover:bg-gray-900/40',
        )}
      >
        <span
          className={clsx(
            'col-start-1 row-span-2 row-start-1 self-start pt-px text-right font-mono text-xs sm:row-span-1 sm:self-center sm:pt-0 sm:text-sm tabular-nums',
            zoneText[getSteakZone(rank, teamCount)],
          )}
        >
          {rank}
        </span>
        <div className="col-start-2 row-start-1 min-w-0">
          <div
            className={clsx(
              'truncate text-sm font-medium',
              isFollowed ? 'text-amber-200' : 'text-gray-100',
            )}
          >
            {team.name}
          </div>
          <div className="text-[11px] sm:text-xs text-gray-500">
            <span className="font-mono tabular-nums">
              {Math.abs(margin).toFixed(1)}
            </span>
            {margin >= 0 ? ' clear' : ' back'}
            {!settled && finish !== null && ` · Finished ${ordinal(finish)}`}
            {risen !== null &&
              (settled
                ? ate && ' · 🧟 Rose from the grave'
                : ` · 🧟 Back from the grave`)}
          </div>
        </div>

        {/* Phones: eat chance up top, the rest under the bar */}
        <div className="col-start-3 row-start-1 flex items-baseline justify-end gap-1.5 sm:hidden">
          <span className="font-mono text-base font-semibold text-gray-100">
            {formatChance(odds.eater, settled)}
          </span>
          <Change change={change} settled={settled} />
        </div>
        <OddsBar
          odds={odds}
          className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1"
        />
        <div className="col-start-3 row-start-2 whitespace-nowrap text-right font-mono text-[10px] text-gray-500 tabular-nums sm:hidden">
          self {formatChance(odds['self-buyer'], settled)} · buy{' '}
          {formatChance(odds.buyer, settled)}
        </div>

        {/* Wider screens: every chance in its own column */}
        <span className="hidden text-right font-mono text-base font-semibold text-gray-100 tabular-nums sm:block">
          {formatChance(odds.eater, settled)}
        </span>
        <span className="hidden text-right font-mono text-xs text-gray-400 tabular-nums sm:block">
          {formatChance(odds['self-buyer'], settled)}
        </span>
        <span className="hidden text-right font-mono text-xs text-gray-400 tabular-nums sm:block">
          {formatChance(odds.buyer, settled)}
        </span>
        <span className="hidden text-right sm:block">
          <Change change={change} settled={settled} />
        </span>
      </button>
    </li>
  );
}

// Teams further behind than anyone has come back from, as a row of headstones
function Graveyard({
  rows,
  teamCount,
  record,
  played,
  followed,
  onSelect,
}: {
  rows: Outlook[];
  teamCount: number;
  record: Comeback;
  played: number;
  followed: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <section className="mt-5">
      <SectionLabel>🪦 The Graveyard</SectionLabel>
      <div className="relative overflow-hidden rounded-lg border border-gray-800/60 bg-gradient-to-b from-gray-950/20 via-gray-950/40 to-emerald-950/30 px-3 pt-5 pb-3">
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-5 sm:gap-x-4">
          {rows.map((row, index) => (
            <Headstone
              key={row.team.id}
              row={row}
              teamCount={teamCount}
              index={index}
              isFollowed={row.team.id === followed}
              onSelect={onSelect}
            />
          ))}
        </ul>
        <p className="mt-4 text-center text-[11px] sm:text-xs text-gray-500">
          {record.deficit > 0
            ? `After week ${played}, no team has come back from more than ${record.deficit.toFixed(1)} points behind the last eater. ${record.name} climbed out from that deep after week ${record.played} in ${record.year}.`
            : `After week ${played}, no team has ever come back from behind the last eater.`}
        </p>
      </div>
    </section>
  );
}

function Headstone({
  row,
  teamCount,
  index,
  isFollowed,
  onSelect,
}: {
  row: Outlook;
  teamCount: number;
  index: number;
  isFollowed: boolean;
  onSelect: (id: string | null) => void;
}) {
  const { team, margin, odds, buriedSince, finish } = row;
  const ateAnyway =
    finish !== null && getSteakZone(finish, teamCount) === 'eater';
  return (
    <li className="flex w-[5.25rem] flex-col items-center sm:w-24">
      <button
        type="button"
        onClick={() => onSelect(isFollowed ? null : team.id)}
        aria-pressed={isFollowed}
        aria-label={`${team.name}, tombstoned since week ${buriedSince}, ${Math.abs(margin).toFixed(1)} points back`}
        title={`${formatChance(odds.eater, false)} by the math`}
        className="w-full overflow-hidden rounded-t-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <div
          className={clsx(
            'tomb-rise rounded-t-[2.75rem] rounded-b-sm border bg-gradient-to-b px-1.5 pb-2 pt-4 text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.08),inset_0_-10px_18px_rgba(0,0,0,0.35)] [text-shadow:0_-1px_0_rgba(0,0,0,0.6)]',
            isFollowed
              ? 'border-amber-300/50 from-gray-500 to-gray-700'
              : 'border-gray-600/40 from-gray-600 to-gray-800',
          )}
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <div className="text-[9px] font-semibold tracking-[0.3em] text-gray-300/70">
            R.I.P.
          </div>
          <div
            className={clsx(
              'mt-1 truncate text-xs font-semibold',
              isFollowed ? 'text-amber-200' : 'text-gray-100',
            )}
          >
            {team.shortName}
          </div>
          <div className="mt-1 font-mono text-[10px] text-gray-300/80 tabular-nums">
            {Math.abs(margin).toFixed(1)} back
          </div>
          <div className="text-[10px] text-gray-400/80">
            since wk {buriedSince}
          </div>
        </div>
      </button>
      {/* The mound it stands in */}
      <div
        aria-hidden="true"
        className="-mt-px h-1.5 w-[120%] rounded-[50%] bg-emerald-950/80"
      />
      {finish !== null && (
        <div
          className={clsx(
            'mt-1 text-center text-[10px]',
            ateAnyway ? 'text-emerald-400' : 'text-gray-600',
          )}
        >
          {ateAnyway
            ? `🧟 Ate anyway (${ordinal(finish)})`
            : `Finished ${ordinal(finish)}`}
        </div>
      )}
    </li>
  );
}
