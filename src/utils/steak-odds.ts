import type { WeeklyScores } from '@/types/Fun';
import type { SteakSeason } from './steak-season';
import { getSteakLine, type SteakZone } from './steak-teams';

// A team's chances of finishing in each part of the steak standings
export type SteakOdds = Record<SteakZone, number>;

// What past seasons say about how scores move from week to week
export interface ScoringModel {
  // How far a team's weekly score typically lands from its own level, once
  // the whole league's good or bad week is taken out
  weeklySpread: number;
  // How many weeks of a team's scores count as much as the league average
  // when judging its level. Early on the average wins out, so a hot start
  // is mostly luck until the weeks pile up.
  priorWeeks: number;
  // Weeks in a full season. Every one of them counts toward the steak race.
  seasonWeeks: number;
}

// Weeks in the given season. The NFL added an 18th week in 2021.
export const weeksInSeason = (year: number) => (year < 2021 ? 17 : 18);

// Simulated seasons behind each set of odds. Enough that a rerun moves no
// team's odds by more than a point.
const RUNS = 10000;

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// Fits the model to finished seasons. Every team in both leagues counts, not
// just the steak teams, since they all play under the same scoring.
export function fitScoringModel(seasons: WeeklyScores[][]): ScoringModel {
  let squares = 0;
  let degrees = 0;
  const levels: number[] = [];

  seasons.forEach((weeks) => {
    const ids = Object.keys(weeks[0]?.scores ?? {});
    // A week where the whole league scores big says nothing about who wins
    // the race, so each score is measured against its week's average
    const weekAverages = weeks.map(({ scores }) =>
      average(ids.map((id) => scores[id] ?? 0)),
    );
    ids.forEach((id) => {
      const relative = weeks.map(
        ({ scores }, i) => (scores[id] ?? 0) - weekAverages[i],
      );
      const level = average(relative);
      levels.push(level);
      relative.forEach((score) => (squares += (score - level) ** 2));
      degrees += relative.length - 1;
    });
  });

  const seasonWeeks = Math.max(...seasons.map((weeks) => weeks.length));
  const weeklyVariance = squares / degrees;
  // Season averages differ partly because teams differ and partly by luck.
  // Take the luck out to see how much teams really differ.
  const levelAverage = average(levels);
  const levelVariance =
    levels.reduce((sum, level) => sum + (level - levelAverage) ** 2, 0) /
    (levels.length - 1);
  const realVariance = Math.max(
    levelVariance - weeklyVariance / seasonWeeks,
    // Never let teams look identical, which would ignore how they've played
    weeklyVariance / 100,
  );

  return {
    weeklySpread: Math.sqrt(weeklyVariance),
    priorWeeks: weeklyVariance / realVariance,
    seasonWeeks,
  };
}

// Small seeded generator, so the same standings always show the same odds
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal draws, two at a time (Box-Muller)
function normalRandom(random: () => number) {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const radius = Math.sqrt(-2 * Math.log(1 - random()));
    const angle = 2 * Math.PI * random();
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

function zoneIndex(rank: number, teamCount: number) {
  const { eaters, selfBuyer } = getSteakLine(teamCount);
  if (rank <= eaters) return 0;
  return selfBuyer && rank === eaters + 1 ? 1 : 2;
}

const toOdds = ([eater, selfBuyer, buyer]: number[]): SteakOdds => ({
  eater,
  'self-buyer': selfBuyer,
  buyer,
});

// Every team's odds after the given number of played weeks, from playing out
// the rest of the season many times. A team's level is its scoring so far,
// pulled toward the league average; each run it lands somewhere around that
// level, with the week-to-week luck on top.
export function simulateSteakOdds(
  season: SteakSeason,
  played: number,
  model: ScoringModel,
): Map<string, SteakOdds> {
  const { teams } = season;
  const teamCount = teams.length;
  const weeksLeft = Math.max(model.seasonWeeks - played, 0);

  // Before a snap, everyone has the same shot
  if (played === 0) {
    const shares = [0, 0, 0];
    teams.forEach(
      (_, rank) => (shares[zoneIndex(rank + 1, teamCount)] += 1 / teamCount),
    );
    return new Map(teams.map((team) => [team.id, toOdds(shares)]));
  }
  // Once the season is over, the standings are the answer
  if (weeksLeft === 0) {
    return new Map(
      teams.map((team) => {
        const odds = [0, 0, 0];
        odds[zoneIndex(team.ranks[played - 1], teamCount)] = 1;
        return [team.id, toOdds(odds)];
      }),
    );
  }

  const weekAverages = Array.from({ length: played }, (_, week) =>
    average(teams.map((team) => team.weekly[week])),
  );
  const trust = played / (played + model.priorWeeks);
  const expected = teams.map((team) => {
    const level =
      trust *
      average(
        team.weekly
          .slice(0, played)
          .map((score, week) => score - weekAverages[week]),
      );
    return team.totals[played - 1] + weeksLeft * level;
  });
  // Luck in the weeks left, plus the chance a team is better or worse than
  // it has looked so far, which counts once for every week left
  const spread =
    model.weeklySpread *
    Math.sqrt(weeksLeft + weeksLeft ** 2 / (played + model.priorWeeks));

  const normal = normalRandom(seededRandom(played * 7919 + teamCount));
  const counts = new Float64Array(teamCount * 3);
  const finals = new Float64Array(teamCount);
  const order = new Int32Array(teamCount);
  for (let run = 0; run < RUNS; run++) {
    for (let i = 0; i < teamCount; i++) {
      finals[i] = expected[i] + spread * normal();
      order[i] = i;
    }
    // Insertion sort is quickest for a couple of dozen teams
    for (let i = 1; i < teamCount; i++) {
      const team = order[i];
      let j = i - 1;
      while (j >= 0 && finals[order[j]] < finals[team]) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = team;
    }
    for (let rank = 0; rank < teamCount; rank++) {
      counts[order[rank] * 3 + zoneIndex(rank + 1, teamCount)]++;
    }
  }

  return new Map(
    teams.map((team, i) => [
      team.id,
      toOdds([0, 1, 2].map((zone) => counts[i * 3 + zone] / RUNS)),
    ]),
  );
}

// The spot a team is chasing: the last eater, or the self-buyer just below,
// which at least spares a team from buying someone else's steak
export type ChaseTarget = Exclude<SteakZone, 'buyer'>;

// The lowest rank that reaches the target. With no self-buyer spot, the
// self-buyer line is the steak line.
export function targetRank(teamCount: number, target: ChaseTarget = 'eater') {
  const { eaters, selfBuyer } = getSteakLine(teamCount);
  return target === 'self-buyer' && selfBuyer ? eaters + 1 : eaters;
}

// Points behind the team holding the target spot after the given number of
// played weeks, for every team. Negative when ahead of it.
export function getDeficits(
  season: SteakSeason,
  played: number,
  target: ChaseTarget = 'eater',
): Map<string, number> {
  const rank = targetRank(season.teams.length, target);
  const totals = season.teams.map((team) => team.totals[played - 1]);
  const line = [...totals].sort((a, b) => b - a)[rank - 1];
  return new Map(season.teams.map((team, i) => [team.id, line - totals[i]]));
}

// A team that reached the target despite trailing it
export interface Comeback {
  name: string;
  year: number;
  // Weeks played at the time, and how far behind it was then
  played: number;
  deficit: number;
}

export interface HistorySeason {
  year: number;
  season: SteakSeason;
}

// The week of a finished past season with as many weeks left as after the
// given week of this one, so a 17-week season lines up with an 18-week one by
// what's still to play. Null when the past season hadn't started yet.
export function matchingWeek(
  past: SteakSeason,
  played: number,
  seasonWeeks: number,
) {
  const week = past.weeks.length - (seasonWeeks - played);
  return week >= 1 ? week : null;
}

// The deepest hole any team was in with the same weeks left and still climbed
// out of to reach the target, by weeks played in this season (index 1 is
// after week one)
export function getWeekComebacks(
  history: HistorySeason[],
  seasonWeeks: number,
  target: ChaseTarget = 'eater',
): (Comeback | null)[] {
  const best: (Comeback | null)[] = Array(seasonWeeks + 1).fill(null);

  history.forEach(({ year, season }) => {
    const last = season.weeks.length - 1;
    const rank = targetRank(season.teams.length, target);
    const made = season.teams.filter((team) => team.ranks[last] <= rank);
    for (let played = 1; played <= seasonWeeks; played++) {
      const week = matchingWeek(season, played, seasonWeeks);
      if (week === null) continue;
      const deficits = getDeficits(season, week, target);
      made.forEach((team) => {
        const deficit = deficits.get(team.id) ?? 0;
        if (deficit >= (best[played]?.deficit ?? 0)) {
          best[played] = { name: team.name, year, played: week, deficit };
        }
      });
    }
  });
  return best;
}

// Raises each week's record to the biggest from any later week. A gap that
// big has been overturned with even less of the season left, so it could be
// again with more.
function carryBack<T>(records: (T | null)[], size: (record: T) => number) {
  const line = [...records];
  for (let played = line.length - 2; played >= 1; played--) {
    const later = line[played + 1];
    const current = line[played];
    if (later && (!current || size(later) > size(current))) {
      line[played] = later;
    }
  }
  return line;
}

// The tombstone line: the deepest comeback from that point of the season or
// later. Anyone deeper than the line has been tombstoned.
export function getTombstoneLine(weekComebacks: (Comeback | null)[]) {
  return carryBack(weekComebacks, (comeback) => comeback.deficit);
}

// Tombstoned: further behind than anyone who came back to eat, with weeks
// still to play. Once the season ends the standings speak for themselves.
export function isTombstoned(
  deficit: number,
  played: number,
  line: (Comeback | null)[],
  seasonWeeks: number,
) {
  const record = line[played];
  return played < seasonWeeks && record !== null && deficit > record.deficit;
}

// Points clear of the first team missing the target, for every team.
// Negative when outside it.
export function getCushions(
  season: SteakSeason,
  played: number,
  target: ChaseTarget = 'eater',
): Map<string, number> {
  const rank = targetRank(season.teams.length, target);
  const totals = season.teams.map((team) => team.totals[played - 1]);
  const firstOut = [...totals].sort((a, b) => b - a)[rank];
  return new Map(
    season.teams.map((team, i) => [team.id, totals[i] - firstOut]),
  );
}

// A team that held the target spot, then lost it by the end of the season
export interface Collapse {
  name: string;
  year: number;
  // Weeks played at the time, and how far clear it was then
  played: number;
  lead: number;
}

// The biggest lead any team blew with the same weeks left, by weeks played in
// this season (index 1 is after week one)
export function getWeekCollapses(
  history: HistorySeason[],
  seasonWeeks: number,
  target: ChaseTarget = 'eater',
): (Collapse | null)[] {
  const worst: (Collapse | null)[] = Array(seasonWeeks + 1).fill(null);

  history.forEach(({ year, season }) => {
    const last = season.weeks.length - 1;
    const rank = targetRank(season.teams.length, target);
    const missed = season.teams.filter((team) => team.ranks[last] > rank);
    for (let played = 1; played <= seasonWeeks; played++) {
      const week = matchingWeek(season, played, seasonWeeks);
      if (week === null) continue;
      const cushions = getCushions(season, week, target);
      missed.forEach((team) => {
        const lead = cushions.get(team.id) ?? 0;
        if (lead > 0 && lead >= (worst[played]?.lead ?? 0)) {
          worst[played] = { name: team.name, year, played: week, lead };
        }
      });
    }
  });
  return worst;
}

// The lock line: the biggest lead blown from that point of the season or
// later. Anyone further clear than that has locked in their spot.
export function getLockLine(weekCollapses: (Collapse | null)[]) {
  return carryBack(weekCollapses, (collapse) => collapse.lead);
}

// Locked in: further clear than anyone who went on to lose the spot, with
// weeks still to play. With no collapse on record from this late, any lead
// has held.
export function isLocked(
  cushion: number,
  played: number,
  lockLine: (Collapse | null)[],
  seasonWeeks: number,
) {
  return played < seasonWeeks && cushion > (lockLine[played]?.lead ?? 0);
}
