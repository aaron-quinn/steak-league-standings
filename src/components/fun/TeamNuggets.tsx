import { useMemo } from 'react';
import { useElementWidth } from '@/hooks/useElementWidth';
import { Num, NuggetList, type Nugget } from '@/components/fun/Nuggets';
import { formatChance, ordinal } from '@/utils/format-score';
import type { RaceTeam, SteakSeason } from '@/utils/steak-season';
import { getSteakLine, getSteakZone } from '@/utils/steak-teams';
import {
  getCushions,
  getDeficits,
  isLocked,
  isTombstoned,
  matchingWeek,
  type Collapse,
  type Comeback,
  type HistorySeason,
  type ScoringModel,
  type SteakOdds,
} from '@/utils/steak-odds';

interface Props {
  team: RaceTeam;
  season: SteakSeason;
  history: HistorySeason[];
  year: number;
  played: number;
  model: ScoringModel;
  // The tombstone and lock lines for the steak line, by weeks played
  line: (Comeback | null)[];
  lockLine: (Collapse | null)[];
  // Every team's odds after the given number of played weeks
  oddsAfter: (week: number) => Map<string, SteakOdds>;
}

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// "+8.3" or "−4.1" points a week
const signed = (value: number) =>
  `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;

// "A", "A and B", "A, B and C"
function listYears(years: number[]) {
  return years.length > 1
    ? `${years.slice(0, -1).join(', ')} and ${years[years.length - 1]}`
    : `${years[0] ?? ''}`;
}

// Past teams within this many points of a spot, widened when too few were
const SPOT_BANDS = [10, 25];
const ENOUGH_TEAMS = 10;

// One team's situation: where it stands, how its odds got here, how it's
// scoring and how teams in its spot have fared before
function getTeamNuggets(
  { team, season, history, year, played, model, line, lockLine }: Props,
  trend: number[],
): Nugget[] {
  const teamCount = season.teams.length;
  const { eaters } = getSteakLine(teamCount);
  const { seasonWeeks } = model;
  const settled = played >= seasonWeeks;
  const weeksLeft = seasonWeeks - played;
  const rank = team.ranks[played - 1];
  const zone = getSteakZone(rank, teamCount);
  const byRank = [...season.teams].sort(
    (a, b) => a.ranks[played - 1] - b.ranks[played - 1],
  );
  const lastEater = byRank[eaters - 1];
  const firstOut = byRank[eaters];
  const deficits = getDeficits(season, played);
  const deficit = deficits.get(team.id) ?? 0;
  const cushion = getCushions(season, played).get(team.id) ?? 0;
  const inside = rank <= eaters;
  const nuggets: Nugget[] = [];

  // Where it stands against the steak line
  if (settled) {
    nuggets.push({
      key: 'finish',
      emoji: '🏁',
      title: 'Finish',
      body: inside ? (
        <>
          {ordinal(rank)} and ate, <Num>{cushion.toFixed(1)}</Num> clear of{' '}
          {firstOut.name}, the first team out.
        </>
      ) : (
        <>
          {ordinal(rank)}, <Num>{deficit.toFixed(1)}</Num> behind{' '}
          {lastEater.name}, the last eater.{' '}
          {zone === 'self-buyer'
            ? 'Bought their own steak.'
            : 'Bought a steak for someone else.'}
        </>
      ),
    });
  } else if (inside) {
    nuggets.push({
      key: 'cushion',
      emoji: '🛡️',
      title: 'Cushion',
      body: (
        <>
          <Num>{cushion.toFixed(1)}</Num> points clear of {firstOut.name}, the
          first team out.
        </>
      ),
    });
  } else {
    nuggets.push({
      key: 'chase',
      emoji: '🎯',
      title: 'The chase',
      body: (
        <>
          <Num>{deficit.toFixed(1)}</Num> behind {lastEater.name}, the last
          eater.{' '}
          {weeksLeft === 1 ? (
            'One week left to make it up.'
          ) : (
            <>
              That’s <Num>{(deficit / weeksLeft).toFixed(1)}</Num> a week over
              the {weeksLeft} weeks left.
            </>
          )}
        </>
      ),
    });
  }

  // The high and low of its eat chance, leaving out the final week, when the
  // odds are just the result
  const open = trend
    .map((chance, week) => ({ chance, week }))
    .slice(1, Math.min(played, seasonWeeks - 1) + 1);
  if (open.length >= 2) {
    const peak = open.reduce((a, b) => (b.chance > a.chance ? b : a));
    const low = open.reduce((a, b) => (b.chance < a.chance ? b : a));
    const swing = open.reduce((a, b) =>
      Math.abs(b.chance - trend[b.week - 1]) >
      Math.abs(a.chance - trend[a.week - 1])
        ? b
        : a,
    );
    const swingPoints = Math.round(
      (swing.chance - trend[swing.week - 1]) * 100,
    );
    const ate = settled && inside;
    nuggets.push({
      key: 'trend',
      emoji: '📈',
      title: 'Eat chance',
      body: (
        <>
          {settled
            ? ate
              ? 'Ate after bottoming out at '
              : 'Missed after peaking at '
            : 'Peaked at '}
          <Num>{formatChance((ate ? low : peak).chance, false)}</Num> after week{' '}
          {(ate ? low : peak).week}
          {!settled && (
            <>
              , low of <Num>{formatChance(low.chance, false)}</Num> after week{' '}
              {low.week}
            </>
          )}
          .
          {swingPoints !== 0 && (
            <>
              {' '}
              Biggest swing:{' '}
              <Num>
                {swingPoints > 0 ? `▲${swingPoints}` : `▼${-swingPoints}`}
              </Num>{' '}
              in week {swing.week}.
            </>
          )}
        </>
      ),
    });
  }

  // How close it is to being locked in, or buried
  if (!settled && cushion > 0) {
    const record = lockLine[played];
    nuggets.push(
      isLocked(cushion, played, lockLine, seasonWeeks)
        ? {
            key: 'locked',
            emoji: '🔒',
            title: 'Locked in',
            body: (
              <>
                No team this far clear after week {played}, or later, has fallen
                out of the eaters.
                {record && (
                  <>
                    {' '}
                    The biggest lead blown was{' '}
                    <Num>{record.lead.toFixed(1)}</Num>, by {record.name} in{' '}
                    {record.year}.
                  </>
                )}
              </>
            ),
          }
        : {
            key: 'lock-line',
            emoji: '🔒',
            title: 'Lock line',
            body: (
              <>
                <Num>{(record!.lead - cushion).toFixed(1)}</Num> points short of
                locking in. {record!.name} blew a{' '}
                <Num>{record!.lead.toFixed(1)}</Num>-point lead after week{' '}
                {record!.played} in {record!.year}.
              </>
            ),
          },
    );
  } else if (!settled && line[played]) {
    const record = line[played]!;
    const buried = (week: number) =>
      isTombstoned(
        getDeficits(season, week).get(team.id) ?? 0,
        week,
        line,
        seasonWeeks,
      );
    if (buried(played)) {
      let since = played;
      while (since > 1 && buried(since - 1)) since--;
      nuggets.push({
        key: 'tombstoned',
        emoji: '🪦',
        title: 'Tombstoned',
        body: (
          <>
            <Num>{(deficit - record.deficit).toFixed(1)}</Num> points below the
            tombstone line
            {since < played ? `, and buried since week ${since}` : ''}. The
            deepest comeback from here was {record.name}’s{' '}
            <Num>{record.deficit.toFixed(1)}</Num> after week {record.played} in{' '}
            {record.year}.
          </>
        ),
      });
    } else {
      nuggets.push({
        key: 'tombstone-line',
        emoji: '🪦',
        title: 'Tombstone line',
        body: (
          <>
            <Num>{(record.deficit - deficit).toFixed(1)}</Num> points above it.
            No team more than <Num>{record.deficit.toFixed(1)}</Num> back this
            late has come back to eat.
          </>
        ),
      });
    }
  }

  // Past teams the same distance from the steak line with as many weeks left
  if (!settled) {
    const spots = history.flatMap(({ season: past }) => {
      const week = matchingWeek(past, played, seasonWeeks);
      if (week === null) return [];
      const pastDeficits = getDeficits(past, week);
      const pastEaters = getSteakLine(past.teams.length).eaters;
      const last = past.weeks.length - 1;
      return past.teams.map((pastTeam) => ({
        gap: Math.abs((pastDeficits.get(pastTeam.id) ?? 0) - deficit),
        ate: pastTeam.ranks[last] <= pastEaters,
      }));
    });
    const band =
      SPOT_BANDS.find(
        (points) =>
          spots.filter(({ gap }) => gap <= points).length >= ENOUGH_TEAMS,
      ) ?? SPOT_BANDS[SPOT_BANDS.length - 1];
    const alike = spots.filter(({ gap }) => gap <= band);
    const ate = alike.filter((spot) => spot.ate).length;
    if (alike.length > 0) {
      nuggets.push({
        key: 'spot',
        emoji: '👥',
        title: 'Teams in this spot',
        body: (
          <>
            After week {played}, <Num>{ate}</Num> of <Num>{alike.length}</Num>{' '}
            past teams within {band} points of here went on to eat (
            {Math.round((100 * ate) / alike.length)}%).
          </>
        ),
      });
    }
  }

  // Scoring against the average steak team, all season and lately
  const weekAverages = Array.from({ length: played }, (_, week) =>
    average(season.teams.map((other) => other.weekly[week])),
  );
  const relative = team.weekly
    .slice(0, played)
    .map((score, week) => score - weekAverages[week]);
  const level = average(relative);
  const trust = played / (played + model.priorWeeks);
  nuggets.push({
    key: 'form',
    emoji: '📊',
    title: 'Form',
    body: (
      <>
        <Num>{signed(level)}</Num> a week against the average steak team
        {played >= 4 && (
          <>
            , <Num>{signed(average(relative.slice(-3)))}</Num> over the last
            three
          </>
        )}
        .
        {!settled && (
          <>
            {' '}
            The odds count on <Num>{signed(trust * level)}</Num> a week from
            here, since hot and cold starts mostly even out.
          </>
        )}
      </>
    ),
  });

  // Its best and worst weeks, and where they ranked among the steak teams
  if (played >= 2) {
    const weeks = team.weekly.slice(0, played).map((score, i) => ({
      score,
      week: season.weeks[i],
      rank: 1 + season.teams.filter((other) => other.weekly[i] > score).length,
    }));
    const best = weeks.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = weeks.reduce((a, b) => (b.score < a.score ? b : a));
    const place = (rank: number) =>
      rank === 1
        ? 'the top score that week'
        : rank === teamCount
          ? 'the lowest that week'
          : `${ordinal(rank)} that week`;
    nuggets.push({
      key: 'weeks',
      emoji: '⭐',
      title: 'Best and worst',
      body: (
        <>
          <Num>{best.score.toFixed(1)}</Num> in week {best.week},{' '}
          {place(best.rank)}. <Num>{worst.score.toFixed(1)}</Num> in week{' '}
          {worst.week}, {place(worst.rank)}.
        </>
      ),
    });
  }

  // Weeks spent inside the steak line, and the current stretch in or out
  const ranks = team.ranks.slice(0, played);
  const eating = ranks.filter((r) => r <= eaters).length;
  let since = played;
  while (since > 1 && ranks[since - 2] <= eaters === inside) since--;
  nuggets.push({
    key: 'eating',
    emoji: '🥩',
    title: 'Weeks eating',
    body:
      eating === 0 ? (
        settled ? (
          'Not one all season.'
        ) : (
          'None yet.'
        )
      ) : eating === played ? (
        settled ? (
          'Every week of the season.'
        ) : (
          'Every week so far.'
        )
      ) : (
        <>
          <Num>{eating}</Num> of <Num>{played}</Num>,{' '}
          {since === played
            ? `${inside ? 'climbing in' : 'falling out'} in week ${since}.`
            : `${inside ? 'inside' : 'outside'} the steak line since week ${since}.`}
        </>
      ),
  });

  // The manager's earlier steak seasons
  const earlier = history
    .filter((past) => past.year < year)
    .flatMap(({ year: pastYear, season: past }) => {
      const pastTeam = past.teams.find((other) => other.name === team.name);
      if (!pastTeam) return [];
      const final = pastTeam.ranks[pastTeam.ranks.length - 1];
      return [{ year: pastYear, zone: getSteakZone(final, past.teams.length) }];
    });
  const ateIn = earlier
    .filter((past) => past.zone === 'eater')
    .map((past) => past.year);
  const selfBought = earlier
    .filter((past) => past.zone === 'self-buyer')
    .map((past) => past.year);
  nuggets.push({
    key: 'record',
    emoji: '📜',
    title: 'Steak record',
    body:
      earlier.length === 0 ? (
        'No earlier steak seasons on record.'
      ) : (
        <>
          Ate in <Num>{ateIn.length}</Num> of <Num>{earlier.length}</Num>{' '}
          earlier season{earlier.length === 1 ? '' : 's'}
          {ateIn.length > 0 && ateIn.length <= 4
            ? ` (${listYears(ateIn)})`
            : ''}
          .
          {selfBought.length > 0 &&
            ` Bought their own in ${listYears(selfBought)}.`}
        </>
      ),
  });

  return nuggets;
}

// A team's story, opened under its row: its eat chance week by week, then
// the nuggets
export default function TeamNuggets(props: Props) {
  const { team, played, model, oddsAfter } = props;
  // From preseason (week 0) to the week on screen
  const trend = useMemo(
    () =>
      Array.from(
        { length: played + 1 },
        (_, week) => oddsAfter(week).get(team.id)?.eater ?? 0,
      ),
    [oddsAfter, team.id, played],
  );

  return (
    <div className="team-open space-y-4">
      {played >= 2 && (
        <OddsTrend trend={trend} seasonWeeks={model.seasonWeeks} />
      )}
      <NuggetList nuggets={getTeamNuggets(props, trend)} />
    </div>
  );
}

// The eat chance after every week so far, across the whole season's width so
// the weeks still to play show as room to the right
function OddsTrend({
  trend,
  seasonWeeks,
}: {
  trend: number[];
  seasonWeeks: number;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const height = 84;
  const pad = { top: 8, right: 34, bottom: 16, left: 30 };
  const plotWidth = Math.max(width - pad.left - pad.right, 0);
  const plotHeight = height - pad.top - pad.bottom;
  const x = (week: number) => pad.left + (week / seasonWeeks) * plotWidth;
  const y = (chance: number) => pad.top + (1 - chance) * plotHeight;
  const points = trend.map((chance, week) => `${x(week)},${y(chance)}`);
  const lastWeek = trend.length - 1;
  const last = trend[lastWeek];

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Eat chance by week, from ${formatChance(trend[0], false)} before the season to ${formatChance(last, false)} after week ${lastWeek}`}
          className="block overflow-visible"
        >
          {/* 0%, even odds and 100% */}
          {[0, 0.5, 1].map((chance) => (
            <g key={chance}>
              <line
                x1={pad.left}
                x2={pad.left + plotWidth}
                y1={y(chance)}
                y2={y(chance)}
                className={
                  chance === 0.5 ? 'stroke-gray-700' : 'stroke-gray-800/70'
                }
                strokeDasharray={chance === 0.5 ? '3 3' : undefined}
              />
              <text
                x={pad.left - 6}
                y={y(chance)}
                dy="0.32em"
                textAnchor="end"
                className="fill-gray-600 font-mono text-[9px]"
              >
                {chance * 100}%
              </text>
            </g>
          ))}
          <text x={x(0)} y={height - 2} className="fill-gray-600 text-[9px]">
            Pre
          </text>
          <text
            x={x(seasonWeeks)}
            y={height - 2}
            textAnchor="end"
            className="fill-gray-600 text-[9px]"
          >
            Wk {seasonWeeks}
          </text>

          {/* The chance so far, drawn in from preseason */}
          <polygon
            points={`${x(0)},${y(0)} ${points.join(' ')} ${x(lastWeek)},${y(0)}`}
            className="fill-emerald-400/[0.07]"
          />
          <polyline
            key={lastWeek}
            points={points.join(' ')}
            pathLength={1}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="steak-draw stroke-emerald-400"
          />
          {trend.map((chance, week) => (
            <circle
              key={week}
              cx={x(week)}
              cy={y(chance)}
              r={week === lastWeek ? 4 : 2}
              className={
                week === lastWeek
                  ? 'fill-emerald-400 stroke-black'
                  : 'fill-emerald-400/60'
              }
              strokeWidth={week === lastWeek ? 2 : 0}
            >
              <title>
                {week === 0
                  ? `Preseason: ${formatChance(chance, false)}`
                  : `After week ${week}: ${formatChance(chance, week >= seasonWeeks)}`}
              </title>
            </circle>
          ))}
          <text
            x={x(lastWeek) + 8}
            y={y(last)}
            dy="0.32em"
            className="fill-gray-200 font-mono text-[11px] font-semibold"
          >
            {formatChance(last, lastWeek >= seasonWeeks)}
          </text>
        </svg>
      )}
    </div>
  );
}
