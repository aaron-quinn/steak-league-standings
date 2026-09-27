import { useEffect, useMemo, useState } from 'react';
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
  projectFinals,
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
  // The same for any season, as its own page shows them
  oddsFor: (year: number, week: number) => Map<string, SteakOdds>;
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

// "never", "once" or "8 times"
function times(count: number) {
  if (count === 0) return 'never';
  if (count === 1) return 'once';
  return (
    <>
      <Num>{count}</Num> times
    </>
  );
}

// Past teams within this many points of a spot, widened when too few were
const SPOT_BANDS = [10, 25];
const ENOUGH_TEAMS = 10;

// One team's situation: where it stands, how its odds got here, how it's
// scoring and how teams in its spot have fared before
function getTeamNuggets(
  { team, season, history, played, model, line, lockLine }: Props,
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

  return nuggets;
}

// One manager's finished seasons before the one on screen, oldest first,
// with the numbers their history nuggets are built from
function getCareer(
  name: string,
  history: HistorySeason[],
  year: number,
  played: number,
  seasonWeeks: number,
) {
  return history
    .filter((past) => past.year < year)
    .flatMap(({ year: pastYear, season: past }) => {
      const pastTeam = past.teams.find((other) => other.name === name);
      if (!pastTeam) return [];
      const weeks = past.weeks.length;
      const final = pastTeam.ranks[weeks - 1];
      const { eaters } = getSteakLine(past.teams.length);
      const week = matchingWeek(past, played, seasonWeeks);
      const byRank = [...past.teams].sort(
        (a, b) => a.ranks[weeks - 1] - b.ranks[weeks - 1],
      );
      const relative = pastTeam.weekly.map(
        (score, i) =>
          score - average(past.teams.map((other) => other.weekly[i])),
      );
      const level = average(relative);
      const weekRanks = pastTeam.weekly.map(
        (score, i) =>
          1 + past.teams.filter((other) => other.weekly[i] > score).length,
      );
      return [
        {
          year: pastYear,
          season: past,
          team: pastTeam,
          final,
          zone: getSteakZone(final, past.teams.length),
          eaters,
          byRank,
          // Its rank with as many weeks left as now, when that season had
          // started by then
          then: week === null ? null : pastTeam.ranks[week - 1],
          relative: level,
          high: Math.max(...pastTeam.weekly),
          // How far it scored from its own level each week, squared, and
          // how many weeks that spread is judged over
          squares: relative.reduce((sum, r) => sum + (r - level) ** 2, 0),
          degrees: weeks - 1,
          // Against the field, over the last four weeks and the rest
          closing: average(relative.slice(-CLOSING_WEEKS)),
          opening: average(relative.slice(0, -CLOSING_WEEKS)),
          tops: weekRanks.filter((rank) => rank === 1).length,
          bottoms: weekRanks.filter((rank) => rank === past.teams.length)
            .length,
          // Points clear of the first team out when it ate, or behind the
          // last eater when it didn't
          margin:
            final <= eaters
              ? getCushions(past, weeks).get(pastTeam.id)!
              : getDeficits(past, weeks).get(pastTeam.id)!,
          // The team on the other side of the steak line from it
          across: final <= eaters ? byRank[eaters] : byRank[eaters - 1],
        },
      ];
    });
}

type Career = ReturnType<typeof getCareer>;

// How far a manager's weekly scores land from their own level, pooled over
// their seasons
const careerSpread = (career: Career) =>
  Math.sqrt(
    career.reduce((sum, past) => sum + past.squares, 0) /
      career.reduce((sum, past) => sum + past.degrees, 0),
  );

// How much better a manager scores in the last weeks than before them
const closingKick = (career: Career) =>
  average(career.map((past) => past.closing - past.opening));

// Its place among every manager with enough seasons, 1 being the highest
function standing(
  value: number,
  all: Map<string, Career>,
  measure: (career: Career) => number,
) {
  const values = [...all.values()].map(measure);
  return {
    place: 1 + values.filter((other) => other > value + 1e-9).length,
    of: values.length,
  };
}

// Seasons a manager needs before they're ranked against the others
const RANKED_SEASONS = 3;
// The closing stretch, in weeks
const CLOSING_WEEKS = 4;
// A finish counts as a close call within this many points of the line
const CLOSE_CALL = 30;
// A comeback or collapse needs odds at least this much against how it ended
const TURNAROUND = 2 / 3;

// A manager's story before this season: how they've done, how they tend to
// play the weeks from here, and the people and moments along the way
function getHistoryNuggets({
  team,
  season,
  history,
  year,
  played,
  model,
}: Props): Nugget[] {
  const { seasonWeeks } = model;
  const teamCount = season.teams.length;
  const { eaters } = getSteakLine(teamCount);
  const settled = played >= seasonWeeks;
  const weeksLeft = seasonWeeks - played;
  const rank = team.ranks[played - 1];
  const inside = rank <= eaters;
  const nuggets: Nugget[] = [];

  const earlier = getCareer(team.name, history, year, played, seasonWeeks);
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

  // Their run of seasons eating or missing, counting this one once it's over
  const runs: { ate: boolean; years: number[] }[] = [];
  [
    ...earlier.map((past) => ({ year: past.year, ate: past.zone === 'eater' })),
    ...(settled ? [{ year, ate: inside }] : []),
  ].forEach((result) => {
    const last = runs[runs.length - 1];
    if (last?.ate === result.ate) last.years.push(result.year);
    else runs.push({ ate: result.ate, years: [result.year] });
  });
  const seasonCount = runs.reduce((sum, run) => sum + run.years.length, 0);
  if (seasonCount >= 2) {
    const current = runs[runs.length - 1];
    const previous = runs[runs.length - 2];
    const span = ({ years }: (typeof runs)[number]) =>
      `${years[0]}–${years[years.length - 1]}`;
    const longest = (ate: boolean) =>
      runs
        .filter((run) => run.ate === ate)
        .reduce<
          (typeof runs)[number] | null
        >((a, b) => (!a || b.years.length > a.years.length ? b : a), null);
    const longestEating = longest(true);
    const n = current.years.length;
    nuggets.push({
      key: 'streak',
      emoji: current.ate ? '🔥' : '🧊',
      title: 'Streak',
      body: (
        <>
          {n >= 2 ? (
            <>
              {current.ate ? 'Ate' : 'Missed'} <Num>{n}</Num> seasons in a row (
              {span(current)})
              {longest(current.ate) === current &&
                runs.some(
                  (run) => run !== current && run.ate === current.ate,
                ) &&
                ', their longest yet'}
              .
            </>
          ) : (
            <>
              {current.ate ? 'Ate' : 'Missed'} in {current.years[0]}, after{' '}
              {previous.ate ? 'eating' : 'missing'}{' '}
              {previous.years.length >= 2 ? (
                <>
                  <Num>{previous.years.length}</Num> in a row
                </>
              ) : (
                `in ${previous.years[0]}`
              )}
              .
            </>
          )}
          {longestEating &&
            longestEating !== current &&
            longestEating.years.length >= 2 && (
              <>
                {' '}
                Longest eating run: <Num>{longestEating.years.length}</Num>{' '}
                seasons ({span(longestEating)}).
              </>
            )}
        </>
      ),
    });
  }

  // The narrowest they've eaten or missed by, when it was close
  const narrowest = (ate: boolean) =>
    earlier
      .filter((past) => past.final <= past.eaters === ate)
      .reduce<
        (typeof earlier)[number] | null
      >((a, b) => (!a || b.margin < a.margin ? b : a), null);
  const calls = [narrowest(false), narrowest(true)]
    .filter((past) => past !== null && past.margin <= CLOSE_CALL)
    .sort((a, b) => a!.margin - b!.margin) as Career;
  if (calls.length > 0) {
    nuggets.push({
      key: 'closest',
      emoji: '😬',
      title: calls.length > 1 ? 'Closest calls' : 'Closest call',
      body: calls.map((past, i) => (
        <span key={past.year}>
          {i > 0 && ' '}
          {past.final <= past.eaters ? 'Ate' : 'Missed'} by{' '}
          <Num>{past.margin.toFixed(1)}</Num> in {past.year},{' '}
          {past.final <= past.eaters ? 'ahead of' : 'behind'} {past.across.name}
          .
        </span>
      )),
    });
  }

  // The manager they've finished right next to most often
  const neighbors = new Map<string, number[]>();
  earlier.forEach((past) => {
    const at = past.byRank.indexOf(past.team);
    [past.byRank[at - 1], past.byRank[at + 1]].forEach((other) => {
      if (other) {
        neighbors.set(other.name, [
          ...(neighbors.get(other.name) ?? []),
          past.year,
        ]);
      }
    });
  });
  const [rival, besideYears] = [...neighbors].reduce<
    [string, number[]] | [null, number[]]
  >((a, b) => (b[1].length > a[1].length ? b : a), [null, []]);
  if (rival && besideYears.length >= 2) {
    const together = earlier.flatMap((past) => {
      const them = past.season.teams.find((other) => other.name === rival);
      return them ? [past.final < them.ranks[them.ranks.length - 1]] : [];
    });
    const now = season.teams.find((other) => other.name === rival);
    nuggets.push({
      key: 'rival',
      emoji: '🤝',
      title: 'Rival',
      body: (
        <>
          Finished right next to {rival} in <Num>{besideYears.length}</Num>{' '}
          seasons ({listYears(besideYears)}), and ahead of them in{' '}
          <Num>{together.filter(Boolean).length}</Num> of{' '}
          <Num>{together.length}</Num> seasons together.
          {now && (
            <>
              {' '}
              {settled ? 'Finished' : 'Now'} {ordinal(rank)} to their{' '}
              {ordinal(now.ranks[played - 1])}.
            </>
          )}
        </>
      ),
    });
  }

  // Where the manager has usually stood with as many weeks left as now
  const lined = earlier.flatMap(({ then, ...past }) =>
    then === null ? [] : [{ ...past, then }],
  );
  if (lined.length >= 2) {
    const best = lined.reduce((a, b) => (b.then < a.then ? b : a));
    const worst = lined.reduce((a, b) => (b.then > a.then ? b : a));
    nuggets.push({
      key: 'usual-spot',
      emoji: '📅',
      title: settled ? 'Usual finish' : 'Usual spot',
      body: (
        <>
          {settled
            ? 'Finished '
            : `With ${weeksLeft} week${weeksLeft === 1 ? '' : 's'} left, stood `}
          <Num>{average(lined.map((past) => past.then)).toFixed(1)}</Num> on
          average across <Num>{lined.length}</Num> earlier seasons, against{' '}
          {ordinal(rank)} {settled ? 'this time' : 'now'}. Best{' '}
          {ordinal(best.then)} in {best.year}, worst {ordinal(worst.then)} in{' '}
          {worst.year}.
        </>
      ),
    });
  }

  // How the manager's earlier seasons went from this point on
  if (!settled && lined.length >= 2) {
    const moved = average(lined.map((past) => past.then - past.final));
    const wasIn = lined.filter((past) => past.then <= past.eaters);
    const wasOut = lined.filter((past) => past.then > past.eaters);
    const heldOn = wasIn.filter((past) => past.final <= past.eaters).length;
    const climbed = wasOut.filter((past) => past.final <= past.eaters).length;
    const inside = wasIn.length > 0 && (
      <>
        inside the steak line here {times(wasIn.length)} and held on in{' '}
        <Num>{heldOn}</Num>
      </>
    );
    const outside = wasOut.length > 0 && (
      <>
        outside {times(wasOut.length)} and climbed in{' '}
        {climbed === 0 ? 'none' : <Num>{climbed}</Num>}
      </>
    );
    nuggets.push({
      key: 'stretch',
      emoji: '🏃',
      title: 'Down the stretch',
      body: (
        <>
          {Math.abs(moved) < 0.05 ? (
            'Has held about level from here to the finish'
          ) : (
            <>
              Has {moved > 0 ? 'climbed' : 'slipped'}{' '}
              <Num>{Math.abs(moved).toFixed(1)}</Num> spots on average from here
              to the finish
            </>
          )}
          . Was {inside}
          {inside && outside && '; '}
          {outside}.
        </>
      ),
    });
  }

  // Points so far against the same week of their best season
  const bestSeason = earlier.reduce<(typeof earlier)[number] | null>(
    (a, b) =>
      !a ||
      b.final < a.final ||
      (b.final === a.final &&
        b.team.totals[b.team.totals.length - 1] >
          a.team.totals[a.team.totals.length - 1])
        ? b
        : a,
    null,
  );
  if (!settled && bestSeason && bestSeason.season.weeks.length >= played) {
    const ahead = team.totals[played - 1] - bestSeason.team.totals[played - 1];
    nuggets.push({
      key: 'pace',
      emoji: '⏱️',
      title: 'Pace',
      body: (
        <>
          <Num>{Math.abs(ahead).toFixed(1)}</Num>{' '}
          {ahead >= 0 ? 'ahead of' : 'behind'} their {bestSeason.year} pace
          after week {played}. They finished {ordinal(bestSeason.final)} that
          season, their best.
        </>
      ),
    });
  }

  // The manager's scoring over earlier seasons, and their best week
  if (earlier.length > 0) {
    const top = earlier.reduce((a, b) => (b.high > a.high ? b : a));
    const peak = earlier.reduce((a, b) => (b.relative > a.relative ? b : a));
    const thisHigh = Math.max(...team.weekly.slice(0, played));
    nuggets.push({
      key: 'career',
      emoji: '🏆',
      title: 'Career scoring',
      body: (
        <>
          <Num>{signed(average(earlier.map((past) => past.relative)))}</Num> a
          week against the average steak team across <Num>{earlier.length}</Num>{' '}
          earlier season
          {earlier.length === 1 ? '' : 's'}
          {earlier.length > 1 && (
            <>
              , best <Num>{signed(peak.relative)}</Num> in {peak.year}
            </>
          )}
          . High week: <Num>{top.high.toFixed(1)}</Num> in {top.year}
          {thisHigh > top.high && (
            <>
              , topped by <Num>{thisHigh.toFixed(1)}</Num> this season
            </>
          )}
          .
        </>
      ),
    });
  }

  // Every manager with enough seasons, to rank this one against
  const careers = new Map(
    [
      ...new Set(
        history
          .filter((past) => past.year < year)
          .flatMap((past) => past.season.teams.map((other) => other.name)),
      ),
    ]
      .map(
        (name) =>
          [name, getCareer(name, history, year, played, seasonWeeks)] as const,
      )
      .filter(([, career]) => career.length >= RANKED_SEASONS),
  );
  const ranked = earlier.length >= RANKED_SEASONS;

  // How much their weekly scores swing, and their weeks at the very top and
  // bottom
  if (earlier.length > 0) {
    const spread = careerSpread(earlier);
    const typical = Math.sqrt(
      earlier.reduce(
        (sum, past) =>
          sum +
          past.season.teams.reduce((teamSum, other) => {
            const weekly = other.weekly.map(
              (score, i) =>
                score -
                average(past.season.teams.map((each) => each.weekly[i])),
            );
            const level = average(weekly);
            return teamSum + weekly.reduce((s, r) => s + (r - level) ** 2, 0);
          }, 0),
        0,
      ) /
        earlier.reduce(
          (sum, past) => sum + past.season.teams.length * past.degrees,
          0,
        ),
    );
    const { place, of } = standing(spread, careers, careerSpread);
    const tops = earlier.reduce((sum, past) => sum + past.tops, 0);
    const bottoms = earlier.reduce((sum, past) => sum + past.bottoms, 0);
    const steady = place > of / 2;
    nuggets.push({
      key: 'swing',
      emoji: '🎢',
      title: 'Boom or bust',
      body: (
        <>
          Weekly scores land <Num>{spread.toFixed(1)}</Num> from their usual
          level, against <Num>{typical.toFixed(1)}</Num> for the typical steak
          team
          {ranked && (
            <>
              , the{' '}
              {steady
                ? `${place === of ? '' : `${ordinal(of - place + 1)} `}steadiest`
                : `${place === 1 ? '' : `${ordinal(place)} `}wildest`}{' '}
              of <Num>{of}</Num> managers
            </>
          )}
          . The week’s top score {times(tops)}, the bottom {times(bottoms)}.
        </>
      ),
    });
  }

  // How they score in the closing stretch against the rest of the season
  if (earlier.length >= 2) {
    const kick = closingKick(earlier);
    const { place, of } = standing(kick, careers, closingKick);
    nuggets.push({
      key: 'closing',
      emoji: '🏇',
      title: 'Closing kick',
      body: (
        <>
          Scores <Num>{Math.abs(kick).toFixed(1)}</Num> a week{' '}
          {kick >= 0 ? 'better' : 'worse'} against the field over the last four
          weeks than before them, across <Num>{earlier.length}</Num> seasons
          {ranked && (
            <>
              , the{' '}
              {place <= of / 2
                ? `${place === 1 ? '' : `${ordinal(place)} `}strongest finisher`
                : `${place === of ? '' : `${ordinal(of - place + 1)} `}weakest finisher`}{' '}
              of <Num>{of}</Num>
            </>
          )}
          .
        </>
      ),
    });
  }

  return nuggets;
}

// A past season's low point in eat chance if the manager ate that year, or
// high point if they didn't, as that season's own page shows it. Only the
// two weeks where its projection looked furthest from how it ended are
// simulated, so a season takes two simulations, not seventeen.
function findTurn(
  past: Career[number],
  model: ScoringModel,
  oddsFor: Props['oddsFor'],
) {
  const weeks = past.season.weeks.length;
  const pastModel = { ...model, seasonWeeks: weeks };
  const ate = past.final <= past.eaters;
  const index = past.season.teams.indexOf(past.team);
  // How many spreads its projected total sat clear of the last seat, leaving
  // out the final week, when the odds are just the result
  const candidates = Array.from({ length: weeks - 1 }, (_, i) => {
    const { expected, spread } = projectFinals(past.season, i + 1, pastModel);
    const others = expected
      .filter((_, other) => other !== index)
      .sort((a, b) => b - a);
    return {
      week: i + 1,
      margin: (expected[index] - others[past.eaters - 1]) / spread,
    };
  })
    .sort((a, b) => (ate ? a.margin - b.margin : b.margin - a.margin))
    .slice(0, 2);
  const turn = candidates
    .map(({ week }) => ({
      week,
      chance: oddsFor(past.year, week).get(past.team.id)?.eater ?? 0,
    }))
    .reduce((a, b) =>
      ate ? (b.chance < a.chance ? b : a) : b.chance > a.chance ? b : a,
    );
  return { year: past.year, ate, ...turn };
}

type Turn = ReturnType<typeof findTurn>;

// The lowest eat chance a manager climbed back from to eat, and the highest
// they let slip
function pickTurnarounds(turns: Turn[]) {
  const comebacks = turns.filter(
    (turn) => turn.ate && turn.chance <= 1 - TURNAROUND,
  );
  const collapses = turns.filter(
    (turn) => !turn.ate && turn.chance >= TURNAROUND,
  );
  return {
    comeback: comebacks.length
      ? comebacks.reduce((a, b) => (b.chance < a.chance ? b : a))
      : null,
    collapse: collapses.length
      ? collapses.reduce((a, b) => (b.chance > a.chance ? b : a))
      : null,
  };
}

// A team's story, opened under its row: its eat chance week by week, then
// the nuggets
export default function TeamNuggets(props: Props) {
  const { team, played, model, oddsAfter, history, year, oddsFor } = props;
  // From preseason (week 0) to the week on screen
  const trend = useMemo(
    () =>
      Array.from(
        { length: played + 1 },
        (_, week) => oddsAfter(week).get(team.id)?.eater ?? 0,
      ),
    [oddsAfter, team.id, played],
  );

  // Found after the story opens, a season per task, since the first time
  // takes a couple of dozen simulations and would otherwise hold up the tap.
  // Kept with the manager and season it's for, so switching teams never
  // shows the last one's.
  const turnsFor = `${team.name}:${year}`;
  const [turns, setTurns] = useState<{
    key: string;
    found: ReturnType<typeof pickTurnarounds>;
  } | null>(null);
  useEffect(() => {
    const career = getCareer(team.name, history, year, 1, model.seasonWeeks);
    const found: Turn[] = [];
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      if (found.length === career.length) {
        setTurns({ key: turnsFor, found: pickTurnarounds(found) });
        return;
      }
      found.push(findTurn(career[found.length], model, oddsFor));
      timer = setTimeout(next);
    };
    timer = setTimeout(next);
    return () => clearTimeout(timer);
  }, [turnsFor, team.name, history, year, model, oddsFor]);
  const found = turns?.key === turnsFor ? turns.found : null;

  const historyNuggets = getHistoryNuggets(props);
  if (found?.comeback) {
    const { chance, week, year: pastYear } = found.comeback;
    historyNuggets.push({
      key: 'comeback',
      emoji: '🧟',
      title: 'Best comeback',
      body: (
        <>
          Down to <Num>{formatChance(chance, false)}</Num> after week {week} in{' '}
          {pastYear}, and still ate.
        </>
      ),
    });
  }
  if (found?.collapse) {
    const { chance, week, year: pastYear } = found.collapse;
    historyNuggets.push({
      key: 'collapse',
      emoji: '💥',
      title: 'Worst collapse',
      body: (
        <>
          Up to <Num>{formatChance(chance, false)}</Num> after week {week} in{' '}
          {pastYear}, and missed.
        </>
      ),
    });
  }

  return (
    <div className="team-open space-y-4">
      {played >= 2 && (
        <OddsTrend trend={trend} seasonWeeks={model.seasonWeeks} />
      )}
      <NuggetList nuggets={getTeamNuggets(props, trend)} />
      <div>
        <h3 className="mb-3 text-[10px] font-medium uppercase tracking-widest text-gray-600">
          {team.name}’s history
        </h3>
        <NuggetList nuggets={historyNuggets} />
      </div>
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
