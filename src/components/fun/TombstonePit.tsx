import clsx from 'clsx';
import { useMemo } from 'react';
import SegmentedTabs from '@/components/SegmentedTabs';
import { useElementWidth } from '@/hooks/useElementWidth';
import type { SteakSeason } from '@/utils/steak-season';
import { getSteakLine, getSteakZone } from '@/utils/steak-teams';
import {
  getCushions,
  getDeficits,
  getLockLine,
  getTombstoneLine,
  getWeekCollapses,
  getWeekComebacks,
  isLocked,
  isTombstoned,
  matchingWeek,
  targetRank,
  type ChaseTarget,
  type Collapse,
  type Comeback,
  type HistorySeason,
} from '@/utils/steak-odds';

// What both the pit and its nuggets are drawn from
interface Props {
  target: ChaseTarget;
  seasonWeeks: number;
  season: SteakSeason;
  history: HistorySeason[];
  played: number;
}

// How each line is described, and what sits on the surface of its pit
const WORDS: Record<
  ChaseTarget,
  {
    line: string;
    goal: string;
    fellFrom: string;
    surface: string;
    // For the teams on the safe side of it
    inside: string;
    fellOut: string;
    missed: string;
    held: string;
    lockedOne: string;
    lockedMany: string;
  }
> = {
  eater: {
    line: 'the last eater',
    goal: 'eat',
    fellFrom: 'straight out of the eaters',
    surface: '🥩',
    inside: 'inside the steak line',
    fellOut: 'fallen out of the eaters',
    missed: 'missed out on a steak',
    held: 'held on to eat',
    lockedOne: 'has a steak locked up',
    lockedMany: 'have steaks locked up',
  },
  'self-buyer': {
    line: 'the self-buyer',
    goal: 'dodge buying',
    fellFrom: 'down into the buyers',
    surface: '🧾',
    inside: 'at or above the self-buyer',
    fellOut: 'fallen into the buyers',
    missed: 'ended up buying',
    held: 'stayed out of the buyers',
    lockedOne: 'is safe from buying',
    lockedMany: 'are safe from buying',
  },
};

// "A", "A and B", "A, B and C"
function listNames(names: string[]) {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : (names[0] ?? '');
}

// Rounds the pit's depth up to a tidy number
function niceCeil(value: number) {
  const step = value > 100 ? 50 : 25;
  return Math.ceil(value / step) * step;
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-gray-100">{children}</span>;
}

interface Nugget {
  key: string;
  emoji: string;
  title: string;
  body: React.ReactNode;
}

interface NuggetInput {
  target: ChaseTarget;
  line: (Comeback | null)[];
  weekComebacks: (Comeback | null)[];
  seasonWeeks: number;
  season: SteakSeason;
  history: HistorySeason[];
  played: number;
  tombstoned: Set<string>;
}

// Fun facts about the week, from this season and the ones before it
function getNuggets({
  target,
  line,
  weekComebacks,
  seasonWeeks,
  season,
  history,
  played,
  tombstoned,
}: NuggetInput): Nugget[] {
  const words = WORDS[target];
  const record = line[played]!;
  const weekRecord = weekComebacks[played];
  const now = getDeficits(season, played, target);
  const nuggets: Nugget[] = [];

  nuggets.push({
    key: 'line',
    emoji: '🪦',
    title: 'Tombstone line',
    body:
      record.deficit > 0 ? (
        <>
          <Num>{record.deficit.toFixed(1)}</Num> points back. No one deeper than
          that at this point of the season, or later, has come back to{' '}
          {words.goal}. {record.name} climbed out of that hole after week{' '}
          {record.played} in {record.year}.
        </>
      ) : (
        `no one behind ${words.line} this late has ever come back.`
      ),
  });

  // Only its own fact when it isn't the comeback that sets the line
  if (weekRecord && weekRecord.deficit > 0 && weekRecord !== record) {
    nuggets.push({
      key: 'week-best',
      emoji: '🪜',
      title: `Best comeback from week ${played}`,
      body: (
        <>
          <Num>{weekRecord.deficit.toFixed(1)}</Num> points back, by{' '}
          {weekRecord.name} in {weekRecord.year}.
        </>
      ),
    });
  }

  if (played > 1) {
    const before = getDeficits(season, played - 1, target);
    const moves = season.teams.map((team) => ({
      team,
      from: before.get(team.id) ?? 0,
      to: now.get(team.id) ?? 0,
    }));
    const climb = moves
      .filter(({ from }) => from > 0)
      .sort((a, b) => b.from - b.to - (a.from - a.to))[0];
    if (climb && climb.from > climb.to) {
      nuggets.push({
        key: 'climb',
        emoji: '🧗',
        title: 'Biggest climb',
        body: (
          <>
            {climb.team.name} clawed back{' '}
            <Num>{(climb.from - climb.to).toFixed(1)}</Num> points this week
            {climb.to <= 0 ? ', all the way out of the pit.' : '.'}
          </>
        ),
      });
    }
    const fall = moves
      .filter(({ to }) => to > 0)
      .sort((a, b) => b.to - b.from - (a.to - a.from))[0];
    if (fall && fall.to > fall.from) {
      nuggets.push({
        key: 'fall',
        emoji: '📉',
        title: 'Biggest fall',
        body: (
          <>
            {fall.team.name} slid <Num>{(fall.to - fall.from).toFixed(1)}</Num>{' '}
            points deeper
            {fall.from <= 0 ? `, ${words.fellFrom}.` : '.'}
          </>
        ),
      });
    }
  }

  // How past chasers at this point of the season fared, and how many of them
  // were already buried
  const pastSeasons = history.filter(
    ({ season: past }) => matchingWeek(past, played, seasonWeeks) !== null,
  );
  let chasers = 0;
  let cameBack = 0;
  let buriedBefore = 0;
  pastSeasons.forEach(({ season: past }) => {
    const week = matchingWeek(past, played, seasonWeeks)!;
    const deficits = getDeficits(past, week, target);
    const rank = targetRank(past.teams.length, target);
    const last = past.weeks.length - 1;
    past.teams.forEach((team) => {
      const deficit = deficits.get(team.id) ?? 0;
      if (deficit <= 0) return;
      chasers++;
      if (team.ranks[last] <= rank) cameBack++;
      if (deficit > record.deficit) buriedBefore++;
    });
  });
  if (chasers > 0) {
    nuggets.push({
      key: 'history',
      emoji: '📜',
      title: 'Chasers who made it',
      body: (
        <>
          After week {played}, <Num>{cameBack}</Num> of <Num>{chasers}</Num>{' '}
          teams behind {words.line} went on to {words.goal} (
          {Math.round((100 * cameBack) / chasers)}%).
        </>
      ),
    });
  }

  const weeksLeft = seasonWeeks - played;
  const longShot = season.teams
    .filter((team) => (now.get(team.id) ?? 0) > 0 && !tombstoned.has(team.id))
    .sort((a, b) => (now.get(b.id) ?? 0) - (now.get(a.id) ?? 0))[0];
  if (longShot && weeksLeft > 0) {
    const deficit = now.get(longShot.id) ?? 0;
    nuggets.push({
      key: 'long-shot',
      emoji: '🔥',
      title: 'Longest shot still breathing',
      body: (
        <>
          {longShot.name}, <Num>{deficit.toFixed(1)}</Num> back, has to outscore{' '}
          {words.line} by <Num>{(deficit / weeksLeft).toFixed(1)}</Num> points a
          week to catch up.
        </>
      ),
    });
  }

  const average = pastSeasons.length ? buriedBefore / pastSeasons.length : 0;
  nuggets.push({
    key: 'census',
    emoji: '⚰️',
    title: 'Graveyard',
    body:
      tombstoned.size === 0 && buriedBefore === 0 ? (
        <>Empty. No team has ever been tombstoned this early.</>
      ) : (
        <>
          <Num>{tombstoned.size}</Num> buried after week {played}. Past seasons
          averaged <Num>{average.toFixed(1)}</Num> by now.
        </>
      ),
  });

  return nuggets;
}

interface LockInput {
  target: ChaseTarget;
  lockLine: (Collapse | null)[];
  weekCollapses: (Collapse | null)[];
  seasonWeeks: number;
  season: SteakSeason;
  history: HistorySeason[];
  played: number;
}

// Fun facts about the teams on the safe side of the line: who's locked in,
// and the leads that have been blown before
function getLockNuggets({
  target,
  lockLine,
  weekCollapses,
  seasonWeeks,
  season,
  history,
  played,
}: LockInput): Nugget[] {
  const words = WORDS[target];
  const record = lockLine[played];
  const weekRecord = weekCollapses[played];
  const nuggets: Nugget[] = [];

  nuggets.push({
    key: 'lock-line',
    emoji: '🔒',
    title: 'Lock line',
    body: record ? (
      <>
        <Num>{record.lead.toFixed(1)}</Num> points clear. No team this far ahead
        at this point of the season, or later, has {words.fellOut}.{' '}
        {record.name} blew a lead that big after week {record.played} in{' '}
        {record.year}.
      </>
    ) : (
      <>
        No team {words.inside} this late has ever {words.fellOut}. Any lead is a
        lock.
      </>
    ),
  });

  // Who's locked in now, who's next, and how that compares with past
  // seasons at the same point
  const cushions = getCushions(season, played, target);
  const inside = season.teams
    .map((team) => ({ team, cushion: cushions.get(team.id) ?? 0 }))
    .filter(({ cushion }) => cushion > 0)
    .sort((a, b) => b.cushion - a.cushion);
  const locked = inside.filter(({ cushion }) =>
    isLocked(cushion, played, lockLine, seasonWeeks),
  );
  const next = inside.find(
    ({ cushion }) => !isLocked(cushion, played, lockLine, seasonWeeks),
  );
  const pastSeasons = history.filter(
    ({ season: past }) => matchingWeek(past, played, seasonWeeks) !== null,
  );
  let lockedBefore = 0;
  let leaders = 0;
  let held = 0;
  pastSeasons.forEach(({ season: past }) => {
    const week = matchingWeek(past, played, seasonWeeks)!;
    const pastCushions = getCushions(past, week, target);
    const rank = targetRank(past.teams.length, target);
    const last = past.weeks.length - 1;
    past.teams.forEach((team) => {
      const cushion = pastCushions.get(team.id) ?? 0;
      if (cushion <= 0) return;
      leaders++;
      if (team.ranks[last] <= rank) held++;
      if (isLocked(cushion, played, lockLine, seasonWeeks)) lockedBefore++;
    });
  });
  const shortOf = (cushion: number) =>
    ((record?.lead ?? 0) - cushion).toFixed(1);
  const lockedNames = locked.map(({ team }) => team.name);
  nuggets.push({
    key: 'locked',
    emoji: words.surface,
    title: 'Locked in',
    body: (
      <>
        {locked.length === 0
          ? 'Nobody yet.'
          : `${
              locked.length > 3
                ? `${locked.length} teams`
                : listNames(lockedNames)
            } ${locked.length === 1 ? words.lockedOne : words.lockedMany}.`}
        {next && (
          <>
            {' '}
            {next.team.name} is {locked.length ? 'next' : 'closest'},{' '}
            <Num>{shortOf(next.cushion)}</Num> short.
          </>
        )}{' '}
        {lockedBefore === 0 ? (
          locked.length > 0 ? (
            'No team had ever locked in this early.'
          ) : (
            'No team has ever locked in this early.'
          )
        ) : (
          <>
            Past seasons averaged{' '}
            <Num>{(lockedBefore / pastSeasons.length).toFixed(1)}</Num> by now.
          </>
        )}
      </>
    ),
  });

  // Only its own fact when it isn't the collapse that sets the line
  if (weekRecord && weekRecord !== record) {
    nuggets.push({
      key: 'collapse',
      emoji: '💥',
      title: `Biggest collapse from week ${played}`,
      body: (
        <>
          {weekRecord.name} was <Num>{weekRecord.lead.toFixed(1)}</Num> clear in{' '}
          {weekRecord.year} and still {words.missed}.
        </>
      ),
    });
  }

  if (leaders > 0) {
    nuggets.push({
      key: 'held',
      emoji: '🛡️',
      title: 'Leads that held',
      body: (
        <>
          After week {played}, <Num>{held}</Num> of <Num>{leaders}</Num> teams{' '}
          {words.inside} {words.held} ({Math.round((100 * held) / leaders)}
          %).
        </>
      ),
    });
  }

  return nuggets;
}

// Only a league with an odd number of steak teams has a self-buyer to chase
export function hasSelfBuyer(season: SteakSeason) {
  return getSteakLine(season.teams.length).selfBuyer;
}

// The comeback records and tombstone line for the spot being chased, and
// who's already buried beneath it
function useChase({ target, seasonWeeks, season, history, played }: Props) {
  const weekComebacks = useMemo(
    () => getWeekComebacks(history, seasonWeeks, target),
    [history, seasonWeeks, target],
  );
  const line = useMemo(() => getTombstoneLine(weekComebacks), [weekComebacks]);
  const deficits = getDeficits(season, Math.max(played, 1), target);
  const tombstoned = new Set(
    season.teams
      .filter((team) =>
        isTombstoned(deficits.get(team.id) ?? 0, played, line, seasonWeeks),
      )
      .map((team) => team.id),
  );
  return { weekComebacks, line, record: line[played], tombstoned };
}

// Fun facts to sit alongside the odds: the teams locked in up top, then the
// ones in the pit. Nothing once the season is over.
export function TombstoneNuggets(props: Props) {
  const { weekComebacks, line, record, tombstoned } = useChase(props);
  const { history, seasonWeeks, target, played } = props;
  const weekCollapses = useMemo(
    () => getWeekCollapses(history, seasonWeeks, target),
    [history, seasonWeeks, target],
  );
  const lockLine = useMemo(() => getLockLine(weekCollapses), [weekCollapses]);
  if (!record || played >= seasonWeeks) return null;

  const groups = [
    {
      title: 'Up top',
      nuggets: getLockNuggets({ ...props, lockLine, weekCollapses }),
    },
    {
      title: 'In the pit',
      nuggets: getNuggets({ ...props, line, weekComebacks, tombstoned }),
    },
  ];

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 text-[10px] font-medium uppercase tracking-widest text-gray-600">
            {group.title}
          </h3>
          <ul className="space-y-3 text-xs sm:text-sm leading-relaxed text-gray-400">
            {group.nuggets.map((nugget) => (
              <li key={nugget.key} className="flex gap-2.5">
                <span aria-hidden="true" className="w-5 shrink-0 text-center">
                  {nugget.emoji}
                </span>
                <p>
                  <span className="font-medium text-gray-200">
                    {nugget.title}:
                  </span>{' '}
                  {nugget.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// The chasing teams, each at the bottom of its own hole below the line,
// with the switch between the steak line and the self-buyer's
export default function TombstonePit({
  onTargetChange,
  selected,
  onSelect,
  ...props
}: Props & {
  onTargetChange: (target: ChaseTarget) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { record, tombstoned } = useChase(props);
  const { target, season, played, seasonWeeks } = props;

  if (!record || played >= seasonWeeks) {
    return (
      <p className="text-xs sm:text-sm text-gray-400">
        {played >= seasonWeeks
          ? 'The season’s over. Step back a week to see who was still clawing their way up, and who was already buried.'
          : 'No finished seasons to compare against yet.'}
      </p>
    );
  }

  return (
    <div>
      {hasSelfBuyer(season) && (
        <div className="mb-4 w-64 sm:w-72">
          <SegmentedTabs
            label="Line to chase"
            tabs={[
              { value: 'eater', label: 'Steak line' },
              { value: 'self-buyer', label: 'Self-buyer line' },
            ]}
            value={target}
            onChange={onTargetChange}
          />
        </div>
      )}
      <Pit
        target={target}
        season={season}
        played={played}
        recordDepth={record.deficit}
        tombstoned={tombstoned}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

function Pit({
  target,
  season,
  played,
  recordDepth,
  tombstoned,
  selected,
  onSelect,
}: {
  target: ChaseTarget;
  season: SteakSeason;
  played: number;
  recordDepth: number;
  tombstoned: Set<string>;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const compact = width < 500;
  const words = WORDS[target];

  const now = getDeficits(season, played, target);
  const before = played > 1 ? getDeficits(season, played - 1, target) : null;
  const chasers = season.teams
    .map((team) => ({
      team,
      deficit: now.get(team.id) ?? 0,
      // Last week's depth, at the surface for a team that was above the line
      previous: before ? Math.max(before.get(team.id) ?? 0, 0) : null,
    }))
    .filter(({ deficit }) => deficit > 0)
    .sort((a, b) => a.deficit - b.deficit);

  // Deep enough to show the tombstone line with room below it, or down to
  // the deepest team when that's not far below. Anyone deeper rests at the
  // bottom, with their real depth in the label.
  const deepest = chasers[chasers.length - 1]?.deficit ?? 0;
  const scaleMax = niceCeil(
    Math.max(
      recordDepth * 1.12,
      Math.min(deepest, recordDepth * 1.6) * 1.05,
      50,
    ),
  );
  const fraction = (deficit: number) =>
    Math.min(Math.max(deficit, 0), scaleMax) / scaleMax;
  const percent = (deficit: number) => `${fraction(deficit) * 100}%`;

  const rulerWidth = 34;
  const plotHeight = compact ? 340 : 420;
  const columnWidth = (width - rulerWidth) / Math.max(chasers.length, 1);
  // Names alternate between two rows when the holes are narrow
  const stagger = columnWidth < 64;
  const headerHeight = stagger ? 34 : 20;
  const tickStep = scaleMax > 100 ? 50 : 25;
  const ticks = Array.from(
    { length: scaleMax / tickStep },
    (_, i) => (i + 1) * tickStep,
  ).filter(
    (tick) =>
      Math.abs(fraction(tick) - fraction(recordDepth)) * plotHeight > 16,
  );

  return (
    <div ref={ref} className="w-full select-none">
      {width > 0 && (
        <div
          className="relative"
          style={{ height: headerHeight + plotHeight + 40 }}
        >
          {/* Names above each hole */}
          <div
            className="absolute right-0 top-0 flex"
            style={{ left: rulerWidth, height: headerHeight }}
          >
            {chasers.map(({ team }, i) => (
              <div key={team.id} className="relative min-w-0 flex-1">
                <span
                  className={clsx(
                    'absolute left-1/2 -translate-x-1/2 truncate text-center text-[10px] sm:text-xs',
                    team.id === selected
                      ? 'font-semibold text-amber-200'
                      : tombstoned.has(team.id)
                        ? 'text-gray-600'
                        : 'text-gray-300',
                  )}
                  style={{
                    bottom: stagger && i % 2 ? 16 : 3,
                    maxWidth: columnWidth * (stagger ? 2 : 1) - 4,
                  }}
                >
                  {team.shortName}
                </span>
              </div>
            ))}
          </div>

          <div
            className="absolute left-0 right-0"
            style={{ top: headerHeight, height: plotHeight }}
          >
            {/* The graveyard, below the tombstone line */}
            <div
              aria-hidden="true"
              className="absolute right-0 -bottom-10 border-t-2 border-gray-300/80 bg-gray-400/[0.07] transition-[top] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ left: rulerWidth, top: percent(recordDepth) }}
            />

            {/* Depth ruler, with what's at stake on the surface */}
            <div
              aria-hidden="true"
              className="absolute left-0 top-0 h-full font-mono text-[10px] text-gray-600"
              style={{ width: rulerWidth }}
            >
              <span className="absolute right-2 -translate-y-1/2 text-sm">
                {words.surface}
              </span>
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute right-2 -translate-y-1/2"
                  style={{ top: percent(tick) }}
                >
                  -{tick}
                </span>
              ))}
              <span
                className="absolute right-1.5 -translate-y-1/2 text-sm transition-[top] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                style={{ top: percent(recordDepth) }}
              >
                🪦
              </span>
            </div>

            {/* The line: the surface everyone is clawing toward, green for
                the steak line and gray for the self-buyer's, like the
                standings */}
            <div
              aria-hidden="true"
              className={clsx(
                'absolute right-0 top-0 h-0.5 -translate-y-1/2 transition-colors duration-300',
                target === 'eater'
                  ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]'
                  : 'bg-gray-400 shadow-[0_0_12px_rgba(163,163,163,0.45)]',
              )}
              style={{ left: rulerWidth }}
            />

            <ol
              className="absolute bottom-0 right-0 top-0 flex"
              style={{ left: rulerWidth }}
            >
              {chasers.map(({ team, deficit, previous }, i) => (
                <Hole
                  key={team.id}
                  name={team.name}
                  lineName={words.line}
                  roomAbove={fraction(deficit) * plotHeight > 36}
                  index={i}
                  deficit={deficit}
                  previous={previous}
                  clipped={deficit > scaleMax}
                  percent={percent}
                  buried={tombstoned.has(team.id)}
                  followed={team.id === selected}
                  zone={getSteakZone(
                    team.ranks[played - 1],
                    season.teams.length,
                  )}
                  played={played}
                  onClick={() =>
                    onSelect(team.id === selected ? null : team.id)
                  }
                />
              ))}
            </ol>
          </div>
        </div>
      )}
      <p className="mt-1 text-[11px] sm:text-xs text-gray-600">
        Points behind {words.line}. Hollow dots show where each team was a week
        ago. Tap a team to follow it.
      </p>
    </div>
  );
}

function Hole({
  name,
  lineName,
  roomAbove,
  index,
  deficit,
  previous,
  clipped,
  percent,
  buried,
  followed,
  zone,
  played,
  onClick,
}: {
  name: string;
  lineName: string;
  // Enough depth above the marker for its numbers
  roomAbove: boolean;
  index: number;
  deficit: number;
  previous: number | null;
  clipped: boolean;
  percent: (deficit: number) => string;
  buried: boolean;
  followed: boolean;
  zone: ReturnType<typeof getSteakZone>;
  played: number;
  onClick: () => void;
}) {
  const depth = percent(deficit);
  const moved = previous === null ? 0 : previous - deficit;
  const climbed = moved > 0.05;
  const fell = moved < -0.05;
  const labelsAbove = climbed && roomAbove;
  const motion =
    'duration-700 ease-[cubic-bezier(0.34,1.35,0.64,1)] motion-reduce:transition-none';
  // CSS custom property for the drop-in animation's landing spot
  const style = {
    '--depth': depth,
    animationDelay: `${index * 60}ms`,
  } as React.CSSProperties;

  return (
    <li className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={followed}
        aria-label={`${name}, ${deficit.toFixed(1)} points behind ${lineName}${buried ? ', tombstoned' : ''}`}
        className="group absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {/* The hole this team has fallen into */}
        <span
          aria-hidden="true"
          className={clsx(
            'pit-dig absolute left-1/2 top-0 w-[55%] max-w-[2.25rem] -translate-x-1/2 rounded-b-md bg-gradient-to-b transition-[height]',
            motion,
            followed
              ? 'from-amber-300/5 to-amber-300/25'
              : 'from-gray-800/10 to-gray-700/50 group-hover:to-gray-600/60',
            clipped &&
              'rounded-b-none [mask-image:linear-gradient(to_bottom,black_85%,transparent)]',
          )}
          style={{ ...style, height: depth }}
        />

        {/* Where it was a week ago, and the trail it left getting here */}
        {previous !== null && (climbed || fell) && (
          <span
            key={played}
            aria-hidden="true"
            className="pit-trail pointer-events-none absolute inset-0"
            // Wait for this team to land, so on first load the trail
            // doesn't show up ahead of a marker still falling in
            style={{ animationDelay: `${650 + index * 60}ms` }}
          >
            <span
              className={clsx(
                'absolute left-1/2 w-0.5 -translate-x-1/2 rounded-full',
                climbed
                  ? 'bg-gradient-to-b from-emerald-400/80 to-emerald-400/0'
                  : 'bg-gradient-to-b from-red-400/0 to-red-400/80',
              )}
              // Between the two spots as drawn, which stop at the pit's floor
              style={{
                top: percent(Math.min(previous, deficit)),
                height: `calc(${percent(Math.max(previous, deficit))} - ${percent(Math.min(previous, deficit))})`,
              }}
            />
            <span
              className="absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-500 bg-black"
              style={{ top: percent(previous) }}
            />
          </span>
        )}

        {/* The team, falling in on load and clawing up or sliding down
            from week to week */}
        <span
          className={clsx(
            'pit-fall absolute inset-x-0 h-0 transition-[top]',
            motion,
          )}
          style={{ ...style, top: depth }}
        >
          <span
            className={clsx(
              'absolute left-1/2 top-0 block -translate-x-1/2 -translate-y-1/2 ring-2 ring-black',
              buried ? 'h-3.5 w-3 rounded-t-full' : 'h-2.5 w-2.5 rounded-full',
              followed
                ? 'bg-amber-300'
                : buried || zone === 'self-buyer'
                  ? 'bg-gray-400'
                  : 'bg-red-400',
            )}
          />
          {/* The numbers sit on the side away from last week's trail: above
              after a climb, when there's room, and below otherwise. The
              depth stays next to the marker either way. */}
          <span
            className={clsx(
              'absolute left-1/2 flex -translate-x-1/2 items-center font-mono leading-tight tabular-nums',
              labelsAbove
                ? 'bottom-[7px] flex-col-reverse'
                : 'top-[7px] flex-col',
            )}
          >
            <span
              className={clsx(
                'whitespace-nowrap text-[9px] sm:text-[11px]',
                followed ? 'text-amber-200' : 'text-gray-400',
              )}
            >
              {clipped && '↓'}
              {/* Whole points once three digits deep, so neighbours don't
                  touch */}
              {deficit.toFixed(deficit >= 100 ? 0 : 1)}
            </span>
            {(climbed || fell) && (
              <span
                className={clsx(
                  'whitespace-nowrap text-[9px] sm:text-[10px]',
                  climbed ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {climbed ? '▲' : '▼'}
                {Math.abs(moved).toFixed(1)}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
