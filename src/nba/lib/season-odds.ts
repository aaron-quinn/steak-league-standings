import type { NbaLeague, NbaTotals, Tonight } from './data';
import { fitModel, seeded, simulate, type OddsModel, type PastSeason, type TeamOdds } from './odds';
import { addLine, emptyLine, type StatLine } from './roto';
import { buildRace, type Race } from './race';
import { personName } from './standings';

// Learned from every finished season except the one shown, so a past season's
// odds never peek at its own ending
export function modelFor(
  season: number,
  history: { season: number; totals: NbaTotals; lastDay: number }[],
): OddsModel {
  const past: PastSeason[] = history
    .filter((h) => h.season !== season)
    .map((h) => ({ ...h.totals, lastDay: h.lastDay }));
  return fitModel(past, 14);
}

// Standings order breaks ties in points by name
export function tieOrder(league: NbaLeague) {
  return new Map(
    [...league.teams]
      .sort((a, b) => personName(a).localeCompare(personName(b)))
      .map((t, i) => [t.id, i]),
  );
}

// Each team's active-lineup games over a season's days so far
export function gamesSoFar(totals: NbaTotals) {
  return new Map(
    Object.entries(totals.games ?? {}).map(([id, days]) => [
      Number(id),
      days.reduce((a, b) => a + b, 0),
    ]),
  );
}

// How much better than a coin flip the eat odds have been after each week of
// the season (Brier skill, leaving each season out, 2018–19 to 2025–26):
// barely early, steadily sharper, nearly certain by the last weeks
const SKILL_BY_WEEK = [
  0.14, 0.14, 0.16, 0.21, 0.25, 0.27, 0.3, 0.32, 0.38, 0.43, 0.46, 0.52, 0.55, 0.59, 0.63,
  0.7, 0.7, 0.7, 0.74, 0.79, 0.87, 0.9, 0.96,
];

// How far to trust today's odds: their track record this far into a season
export function oddsConfidence(elapsed: number) {
  const week = Math.min(Math.max(elapsed / 7, 1), SKILL_BY_WEEK.length);
  const below = Math.floor(week);
  const skill =
    SKILL_BY_WEEK[below - 1] +
    (week - below) * ((SKILL_BY_WEEK[below] ?? SKILL_BY_WEEK[below - 1]) - SKILL_BY_WEEK[below - 1]);
  return { skill, level: skill < 0.35 ? 'Low' : skill < 0.65 ? 'Medium' : 'High' };
}

// How much of today's slate the live totals hold: its finished games, and half
// of those being played. A day without games is over. Unknown counts as none.
export function todayPlayed(tonight: Tonight | undefined, latestDay: number) {
  if (!tonight || tonight.day !== latestDay) return 0;
  if (!tonight.games.length) return 1;
  const done = tonight.games.reduce(
    (sum, g) => sum + (g.state === 'post' ? 1 : g.state === 'in' ? 0.5 : 0),
    0,
  );
  return done / tonight.games.length;
}

// Odds today, from the league's live totals and each team's games so far.
// Today (latestDay) is still being played: only `played` of it is in the
// totals, and the rest is projected with the days to come.
export function currentOdds(
  league: NbaLeague,
  model: OddsModel,
  games?: Map<number, number>,
  played = 0,
  runs = 4000,
) {
  const totals = new Map<number, StatLine>(league.teams.map((t) => [t.id, t.totals]));
  const elapsed = Math.max(0, league.latestDay - 1 + played);
  return simulate(
    {
      totals,
      games,
      elapsed,
      remaining: Math.max(0, league.finalDay - elapsed),
    },
    model,
    tieOrder(league),
    runs,
    seeded(league.latestDay),
  );
}

export interface OddsHistory {
  race: Race;
  // Eat odds for each team at each checkpoint of the race
  eat: Map<number, number[]>;
}

export interface OddsStory {
  label: string;
  value: string;
  detail: string;
  teamID?: number;
  // The checkpoint the story happened at, to jump the replay there
  week?: number;
}

const pct = (p: number) =>
  p >= 0.995 ? '>99%' : p > 0 && p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`;

// The season's turns, read off the odds: who came back from the dead, who
// blew it, when things were settled
export function oddsStories(
  history: OddsHistory,
  // Teams tombstoned at each checkpoint (see useSteakOdds)
  buriedAt?: (week: number) => Set<number>,
): OddsStory[] {
  const { race, eat } = history;
  const end = race.checkpoints.length - 1;
  if (end < 2) return [];
  const when = (i: number) => race.checkpoints[i].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  // Leave out the final checkpoint, when every team is 0% or 100%
  const before = (id: number) => eat.get(id)!.slice(0, end);
  const ate = (t: (typeof race.teams)[number]) => t.zones[end] === 'eater';
  const stories: OddsStory[] = [];

  const comeback = race.teams
    .filter(ate)
    .map((t) => {
      const odds = before(t.id);
      const low = Math.min(...odds);
      return { t, low, week: odds.indexOf(low) };
    })
    .sort((a, b) => a.low - b.low)[0];
  if (comeback && comeback.low < 0.5) {
    stories.push({
      label: 'Biggest comeback',
      value: comeback.t.short,
      detail: `Ate after falling to ${pct(comeback.low)} (${when(comeback.week)})`,
      teamID: comeback.t.id,
      week: comeback.week,
    });
  }

  const collapse = race.teams
    .filter((t) => !ate(t))
    .map((t) => {
      const odds = before(t.id);
      const high = Math.max(...odds);
      return { t, high, week: odds.indexOf(high) };
    })
    .sort((a, b) => b.high - a.high)[0];
  if (collapse && collapse.high > 0.5) {
    stories.push({
      label: 'Worst collapse',
      value: collapse.t.short,
      detail: `Bought after reaching ${pct(collapse.high)} (${when(collapse.week)})`,
      teamID: collapse.t.id,
      week: collapse.week,
    });
  }

  // From this week on, never below 99% (or above 1%) again
  const settledFrom = (odds: number[], test: (p: number) => boolean) => {
    let from = odds.length;
    for (let i = odds.length - 1; i >= 0 && test(odds[i]); i--) from = i;
    return from;
  };
  const safe = race.teams
    .filter(ate)
    .map((t) => ({ t, week: settledFrom(before(t.id), (p) => p >= 0.99) }))
    .sort((a, b) => a.week - b.week)[0];
  if (safe && safe.week < end) {
    stories.push({
      label: 'Safe first',
      value: safe.t.short,
      detail: `Over 99% from ${when(safe.week)} on`,
      teamID: safe.t.id,
      week: safe.week,
    });
  }
  // The first team buried for good
  if (buriedAt) {
    const sets = Array.from({ length: end }, (_, i) => buriedAt(i));
    const buried = race.teams
      .map((t) => ({ t, week: settledFrom(sets.map((s) => (s.has(t.id) ? 1 : 0)), (v) => v === 1) }))
      .sort((a, b) => a.week - b.week)[0];
    if (buried && buried.week < end) {
      stories.push({
        label: 'First tombstone 🪦',
        value: buried.t.short,
        detail: `Buried from ${when(buried.week)} on`,
        teamID: buried.t.id,
        week: buried.week,
      });
    }
  }

  let swing = { t: race.teams[0], change: 0, week: 0 };
  for (const t of race.teams) {
    const odds = eat.get(t.id)!;
    for (let i = 1; i < end; i++) {
      const change = odds[i] - odds[i - 1];
      if (Math.abs(change) > Math.abs(swing.change)) swing = { t, change, week: i };
    }
  }
  if (swing.change) {
    stories.push({
      label: 'Wildest week',
      value: swing.t.short,
      detail: `${swing.change > 0 ? 'Up' : 'Down'} ${Math.round(Math.abs(swing.change) * 100)} points the week of ${when(swing.week)}`,
      teamID: swing.t.id,
      week: swing.week,
    });
  }

  // The last week some team's fate was still a real question
  let open = -1;
  for (let i = 0; i < end; i++) {
    if (race.teams.some((t) => eat.get(t.id)![i] > 0.05 && eat.get(t.id)![i] < 0.95)) open = i;
  }
  if (open >= 0) {
    const undecided = race.teams.filter((t) => {
      const p = eat.get(t.id)![open];
      return p > 0.05 && p < 0.95;
    });
    stories.push({
      label: 'Went down to',
      value: when(open),
      detail: `${undecided.map((t) => t.short).join(' and ')} still in doubt`,
      week: open,
    });
  }
  return stories;
}

// Eat odds at the end of every lineup week
export function oddsHistory(
  league: NbaLeague,
  totals: NbaTotals,
  model: OddsModel,
  endDay: number,
  runs = 800,
): OddsHistory {
  const race = buildRace(league, totals);
  const order = tieOrder(league);
  const eat = new Map<number, number[]>(league.teams.map((t) => [t.id, []]));
  const running = new Map<number, StatLine>(league.teams.map((t) => [t.id, emptyLine()]));
  // Games so far, when the totals record them (the odds project per game)
  const played = totals.games ? new Map(league.teams.map((t) => [t.id, 0])) : undefined;
  let i = 0;
  for (const checkpoint of race.checkpoints) {
    while (i < totals.days.length && totals.days[i] <= checkpoint.day) {
      for (const t of league.teams) {
        addLine(running.get(t.id)!, totals.teams[t.id]?.[i] ?? emptyLine());
        played?.set(t.id, played.get(t.id)! + (totals.games?.[t.id]?.[i] ?? 0));
      }
      i++;
    }
    const remaining = Math.max(0, endDay - checkpoint.day);
    let odds: Map<number, TeamOdds>;
    if (remaining === 0) {
      odds = simulate({ totals: running, elapsed: checkpoint.day, remaining: 0 }, model, order, 1);
    } else {
      odds = simulate(
        {
          totals: new Map([...running].map(([id, l]) => [id, [...l]])),
          games: played && new Map(played),
          elapsed: checkpoint.day,
          remaining,
        },
        model,
        order,
        runs,
        seeded(checkpoint.day),
      );
    }
    for (const [id, o] of odds) eat.get(id)!.push(o.eat);
  }
  return { race, eat };
}
