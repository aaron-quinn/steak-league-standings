// Games each fantasy team lost to absences: a starter whose NBA team played
// without him. Lineups are weekly, so a starter who goes down mid-week costs
// his team every game until the next lineup; one who was already out when the
// week's lineup locked and stayed in it is the manager's call. Players on the
// bench or IR don't count: a stash costs nothing.
//
// ESPN keeps no record of why a player sat, only that he did. A run of two or
// more missed games reads as an injury; a lone missed game is rest, illness or
// a minor knock.
//
// buildInjuryData reads the daily lineups (scripts/nba/build-injuries.mjs for
// finished seasons, the live chunks for the current one) into the compact
// InjuryData; summarizeInjuries prices it in roto points.
import type { NbaLeague, PlayerLine } from './data';
import type { PlayerPool } from './comps';
import { addLine, emptyLine, scoreRoto, type StatLine } from './roto.ts';
import { nbaTeamOnDay, teamsByDay, type NbaSchedule } from './schedule.ts';
import { linePoints, pointRates } from './value.ts';
import { lineupWeeks, type LineupWeek } from './week.ts';

const BENCH = 12;
const IR = 13;
const isStarter = (slot: number | undefined) => slot !== undefined && slot !== BENCH && slot !== IR;

export interface InjuryDay {
  day: number;
  rosters?: Record<string, number[]>;
  slots?: Record<string, number>;
  players: PlayerLine[];
  playedFor?: Record<string, number>;
}

// [fantasy team, player, day, first day of his absence, games the absence ran]
export type Miss = [number, number, number, number, number];

export interface InjuryData {
  // The last day counted
  through: number;
  // [fantasy team, player, games his NBA team played while he started]
  starts: [number, number, number][];
  misses: Miss[];
  // Player → [games, ...stat totals]: his season while rostered, or his last
  // season's if he never played this one
  lines: Record<string, number[]>;
  // Player → share of his NBA team's games he missed over the last two
  // seasons, pulled toward the league's usual share by how little of them
  // there is
  rates: Record<string, number>;
}

export interface InjuryInput {
  days: InjuryDay[];
  schedule: NbaSchedule;
  through: number;
  names: Record<string, string>;
  proTeams: Record<string, number>;
  // Earlier seasons' totals for every NBA player, newest first
  priors: PlayerPool[];
}

// How much a typical rotation player misses, and how many games of history
// it takes to count as much as that typical share
const USUAL_MISS_RATE = 0.15;
const RATE_WEIGHT = 41;

// A season's length in games: what nearly every full-season player reached
// (traded players can play a few more)
export function seasonGames(pool: PlayerPool) {
  const games = pool.players.map((p) => p[1]).sort((a, b) => a - b);
  return games[Math.floor(games.length * 0.95)] ?? 82;
}

export function missRates(ids: Iterable<number>, names: Record<string, string>, priors: PlayerPool[]) {
  const pools = priors.slice(0, 2).map((pool) => ({
    games: seasonGames(pool),
    byName: new Map(pool.players.map((p) => [p[0], p[1]])),
  }));
  const rates: Record<string, number> = {};
  for (const id of ids) {
    let missed = 0;
    let games = 0;
    for (const pool of pools) {
      // Missing from a season: a rookie, or out of the league; no evidence
      const played = pool.byName.get(names[id]);
      if (played === undefined) continue;
      missed += Math.max(0, pool.games - played);
      games += pool.games;
    }
    rates[id] = Math.round(((missed + RATE_WEIGHT * USUAL_MISS_RATE) / (games + RATE_WEIGHT)) * 1000) / 1000;
  }
  return rates;
}

export function buildInjuryData({ days, schedule, through, names, proTeams, priors }: InjuryInput): InjuryData {
  const sorted = [...days].sort((a, b) => a.day - b.day).filter((d) => d.day <= through);
  const playing = teamsByDay(schedule);
  const teamOn = nbaTeamOnDay(sorted);
  const proTeam = (id: number, d: InjuryDay) => d.playedFor?.[id] ?? teamOn(id, d.day) ?? proTeams[id];

  const starts = new Map<string, number>();
  const misses: Miss[] = [];
  const lines = new Map<number, number[]>();
  // Player → his absence so far: first day, and each missed game's team and slot
  const open = new Map<number, { start: number; games: [number, number, number][] }>();
  const close = (id: number) => {
    const spell = open.get(id);
    if (!spell) return;
    for (const [team, day, slot] of spell.games) {
      if (isStarter(slot)) misses.push([team, id, day, spell.start, spell.games.length]);
    }
    open.delete(id);
  };

  let rosters: Record<string, number[]> = {};
  for (const d of sorted) {
    if (d.rosters) rosters = d.rosters;
    const played = new Set<number>();
    for (const p of d.players) {
      if (p[3] <= 0) continue;
      played.add(p[1]);
      const line = lines.get(p[1]) ?? [0, ...emptyLine()];
      line[0] += p[3];
      for (let i = 0; i < 10; i++) line[i + 1] += p[4 + i] ?? 0;
      lines.set(p[1], line);
    }
    const games = playing.get(d.day);
    const seen = new Set<number>();
    for (const [team, roster] of Object.entries(rosters)) {
      for (const id of roster) {
        seen.add(id);
        const pro = proTeam(id, d);
        const hadGame = played.has(id) || (pro !== undefined && games?.has(pro));
        if (!hadGame) continue;
        const slot = d.slots?.[id];
        if (isStarter(slot)) {
          const key = `${team}:${id}`;
          starts.set(key, (starts.get(key) ?? 0) + 1);
        }
        if (played.has(id)) {
          close(id);
          continue;
        }
        const spell = open.get(id) ?? { start: d.day, games: [] };
        spell.games.push([Number(team), d.day, slot ?? BENCH]);
        open.set(id, spell);
      }
    }
    // Off every roster while his team played: nobody saw whether he did,
    // so the absence ends there
    for (const id of [...open.keys()]) {
      if (seen.has(id)) continue;
      const pro = teamOn(id, d.day) ?? proTeams[id];
      if (pro !== undefined && games?.has(pro)) close(id);
    }
  }
  for (const id of [...open.keys()]) close(id);
  misses.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);

  const starters = new Set([...starts.keys()].map((k) => Number(k.split(':')[1])));
  // Players who never played while rostered: price them by last season
  const lastSeason = new Map((priors[0]?.players ?? []).map((p) => [p[0], p]));
  const out: Record<string, number[]> = {};
  for (const id of starters) {
    const own = lines.get(id);
    if (own && own[0] > 0) out[id] = own;
    else {
      const prior = lastSeason.get(names[id]);
      if (prior) out[id] = [prior[1], ...(prior.slice(3) as number[])];
    }
  }

  return {
    through,
    starts: [...starts].map(([k, games]) => {
      const [team, id] = k.split(':').map(Number);
      return [team, id, games];
    }),
    misses,
    lines: out,
    rates: missRates(starters, names, priors),
  };
}

export interface TeamInjuries {
  id: number;
  // Games his NBA team played while a player was in this team's lineup
  starts: number;
  lost: number;
  // Lost while the player was already out when the week's lineup locked
  keptIn: number;
  points: number;
  // Points lost to surprises (out after the lineup locked) and to players
  // kept in the lineup though already out
  surprisePoints: number;
  keptInPoints: number;
  // A league-average share of surprise absences, given each starter's history
  expectedGames: number;
  expectedPoints: number;
  // Expected minus actual points lost to surprises: below zero is bad luck.
  // Keeping an injured player in the lineup is a choice, so it isn't luck.
  luck: number;
  rank: number;
  healthyRank: number;
  healthyPoints: number;
  rotoPoints: number;
  // Games lost each lineup week
  weeks: { games: number; points: number }[];
}

export interface Absence {
  team: number;
  player: number;
  from: number;
  to: number;
  // Starter games this team lost, and every game the absence ran
  lost: number;
  length: number;
  keptIn: number;
  points: number;
}

export interface InjurySummary {
  teams: TeamInjuries[];
  absences: Absence[];
  weeks: LineupWeek[];
}

export function summarizeInjuries(
  data: InjuryData,
  league: NbaLeague,
  { multiOnly = false }: { multiOnly?: boolean } = {},
): InjurySummary {
  const rates = pointRates(league);
  const perGame = new Map<number, StatLine>();
  const value = new Map<number, number>();
  for (const [id, [games, ...totals]] of Object.entries(data.lines)) {
    const line = totals.map((v) => (games ? v / games : 0));
    perGame.set(Number(id), line);
    value.set(Number(id), Math.max(0, linePoints(line, rates)));
  }
  const weeks = lineupWeeks(league.opener, league.finalDay).filter((w) => w.first <= data.through);
  const weekOf = (day: number) => weeks.findIndex((w) => day >= w.first && day <= w.last);

  const teams = new Map<number, TeamInjuries>(
    league.teams.map((t) => [
      t.id,
      {
        id: t.id,
        starts: 0,
        lost: 0,
        keptIn: 0,
        points: 0,
        surprisePoints: 0,
        keptInPoints: 0,
        expectedGames: 0,
        expectedPoints: 0,
        luck: 0,
        rank: 0,
        healthyRank: 0,
        healthyPoints: 0,
        rotoPoints: 0,
        weeks: weeks.map(() => ({ games: 0, points: 0 })),
      },
    ]),
  );
  const healthy = new Map(league.teams.map((t) => [t.id, [...t.totals]]));
  const absences = new Map<string, Absence>();

  for (const [teamID, id, day, start, length] of data.misses) {
    if (multiOnly && length < 2) continue;
    const team = teams.get(teamID);
    if (!team) continue;
    const week = weekOf(day);
    const keptIn = week >= 0 && start < weeks[week].first ? 1 : 0;
    const points = value.get(id) ?? 0;
    team.lost++;
    team.keptIn += keptIn;
    team.points += points;
    if (keptIn) team.keptInPoints += points;
    else team.surprisePoints += points;
    if (week >= 0) {
      team.weeks[week].games++;
      team.weeks[week].points += points;
    }
    const line = perGame.get(id);
    if (line) addLine(healthy.get(teamID)!, line);
    const key = `${teamID}:${id}:${start}`;
    const a = absences.get(key) ?? { team: teamID, player: id, from: day, to: day, lost: 0, length, keptIn: 0, points: 0 };
    a.to = day;
    a.lost++;
    a.keptIn += keptIn;
    a.points += points;
    absences.set(key, a);
  }

  // Expected: each starter missing his usual share, scaled so the league as a
  // whole expects the surprise absences it actually had. Luck is then
  // relative: who lost more than their starters' histories said they would.
  let rawGames = 0;
  for (const [teamID, id, games] of data.starts) {
    const team = teams.get(teamID);
    if (!team) continue;
    const rate = data.rates[id] ?? USUAL_MISS_RATE;
    team.starts += games;
    team.expectedGames += games * rate;
    team.expectedPoints += games * rate * (value.get(id) ?? 0);
    rawGames += games * rate;
  }
  const surprises = [...teams.values()].reduce((s, t) => s + t.lost - t.keptIn, 0);
  const scale = rawGames ? surprises / rawGames : 0;
  for (const t of teams.values()) {
    t.expectedGames *= scale;
    t.expectedPoints *= scale;
    t.luck = t.expectedPoints - t.surprisePoints;
  }

  const actual = scoreRoto(new Map(league.teams.map((t) => [t.id, t.totals])));
  const whole = scoreRoto(healthy);
  actual.forEach((r, i) => {
    const t = teams.get(r.id)!;
    t.rank = i + 1;
    t.rotoPoints = r.points;
  });
  whole.forEach((r, i) => {
    const t = teams.get(r.id)!;
    t.healthyRank = i + 1;
    t.healthyPoints = r.points;
  });

  return {
    teams: [...teams.values()],
    absences: [...absences.values()].sort((a, b) => b.points - a.points),
    weeks,
  };
}
