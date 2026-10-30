// Roster strength for the live season. Every rostered player gets two values
// in roto points (see value.ts): what he has produced this season, and what
// he projects to add from here. The projection is his per-game line blended
// with his last two seasons, times his NBA team's games left and the share of
// games he's played this season and the last two. Each team's best nine (a
// week's starters) are added up and run through the roto standings.
//
// Values use last season's rates (stats per standings place), which are
// steadier than a few weeks of this one's.
import type { PlayerPool, PoolPlayer } from './comps';
import type { NbaDay, NbaLeague } from './data';
import { seasonGames } from './injuries.ts';
import { inferTrades } from './moves.ts';
import { addLine, emptyLine, scoreRoto, type CategoryResult, type StatLine } from './roto.ts';
import type { NbaSchedule } from './schedule.ts';
import { categoryPoints, linePoints, type PointRates } from './value.ts';

const BENCH = 12;
const IR = 13;
const isStarterSlot = (slot: number | undefined) => slot !== undefined && slot !== BENCH && slot !== IR;

export interface ProjectionOptions {
  // The most games of history the per-game blend counts, as if he had played
  // them this season: by then, this season's line weighs as much as the past
  priorGames: number;
  // Last season's weight, then the one before's
  priorWeights: number[];
  // Availability: the share of his NBA team's games he played (this season,
  // last, the one before, weighted as above), pulled toward a typical share
  // by this many games of it
  playWeight: number;
  usualPlay: number;
}

// Chosen against outside rest-of-season ranks on Oct 30, 2026 (Spearman over
// the league's 200 rostered players): FantasyPros' consensus 0.875 and ESPN's
// projections valued in these categories 0.857, where the two agree with
// each other at 0.912. Experts barely discount for past missed games: the
// heavy pull here keeps availability between about 0.75 and 0.9, where a
// lighter one (41 games) sank Embiid to 124th and scored 0.78 and 0.73.
export const PROJECTION: ProjectionOptions = {
  priorGames: 45,
  priorWeights: [1, 0.5],
  playWeight: 400,
  usualPlay: 0.85,
};

export type Acquired =
  | { how: 'draft'; price: number; keeper: boolean }
  | { how: 'waiver' | 'free agent'; bid: number; day: number }
  | { how: 'trade'; day: number };

export interface RosterPlayer {
  id: number;
  name: string;
  team: number;
  slot: number;
  proTeam?: number;
  // This season, every NBA game (not only while rostered)
  games: number;
  seasonLine: StatLine;
  seasonValue: number;
  // Among rostered players; 0 before his first game
  seasonRank: number;
  // The blended per-game line the projection runs on (null: no games ever)
  perGame: StatLine | null;
  // His NBA team's games left, and the share of them he's expected to play
  remaining: number;
  availability: number;
  restLine: StatLine;
  projectedValue: number;
  projectedRank: number;
  // In his team's projected nine
  starter: boolean;
  // His NBA team's games in a row he has missed, through the latest day, and
  // ESPN's injury status ('ACTIVE', 'DAY_TO_DAY', 'OUT', ...) when it has one
  out: number;
  status?: string;
  availabilitySource: 'RotoWire' | 'ESPN' | 'History';
  acquired?: Acquired;
}

export interface Standing {
  points: number;
  rank: number;
  categories: CategoryResult[];
}

export interface TeamStrength {
  id: number;
  // Best projected value first
  players: RosterPlayer[];
  // The rest-of-season lineup alone; the standings today; today plus the rest
  roster: Standing;
  now: Standing;
  finish: Standing;
  // Projected value of the best nine, the rest of the bench and IR
  starters: number;
  bench: number;
  ir: number;
  // This week's actual lineup, and the best nine of those not out (see
  // isOut), at the same values
  lineup: number;
  available: number;
  // Roster strength on each day in `days`: that day's roster at today's values
  trend: number[];
}

export interface RosterModel {
  teams: TeamStrength[];
  players: RosterPlayer[];
  days: number[];
  starters: number;
  totals: Map<number, StatLine>;
  rates: PointRates;
}

export interface RosterInput {
  league: NbaLeague;
  days: NbaDay[];
  names: Record<string, string>;
  proTeams: Record<string, number>;
  schedule: NbaSchedule;
  // This season's totals for every NBA player, and the last two seasons'
  // (newest first)
  pool: PlayerPool;
  priors: PlayerPool[];
  rates: PointRates;
  options?: ProjectionOptions;
  // ESPN's projected games for the season and injury status, by player ID
  // (worker/nba/espn.js compactProjections). Its games know about long
  // injuries the box scores can't, so they set availability where ESPN has a
  // number.
  espn?: Record<string, [number | null, string]>;
  // Snapshot converted from RotoWire remaining games to a season total by
  // adding games played at fetch time. This avoids counting played games twice.
  rotowire?: Record<string, number>;
}

const statsOf = (p: PoolPlayer | undefined) => (p ? (p.slice(3) as number[]) : undefined);

// Per-game line: this season's, pulled toward the last two seasons' by up to
// PRIOR_GAMES games of them. A rookie, or anyone with less history than that,
// has the rest filled with a typical end-of-roster line, so four hot games
// don't make a star. Makes and attempts blend separately, so the shooting
// percentages come out weighted by volume.
function blend(
  current: PoolPlayer | undefined,
  priors: (PoolPlayer | undefined)[],
  baseline: StatLine,
  { priorGames: full, priorWeights }: ProjectionOptions,
) {
  const prior = emptyLine();
  let priorGames = 0;
  priors.forEach((p, i) => {
    const stats = statsOf(p);
    if (!p || !stats) return;
    const w = priorWeights[i] ?? 0;
    priorGames += w * p[1];
    stats.forEach((v, s) => (prior[s] += w * v));
  });
  const games = current?.[1] ?? 0;
  if (games + priorGames === 0) return null;
  const own = statsOf(current) ?? emptyLine();
  const history = Math.min(full, priorGames);
  const filler = full - history;
  return own.map(
    (v, s) =>
      (v + (priorGames ? (prior[s] / priorGames) * history : 0) + baseline[s] * filler) /
      (games + full),
  );
}

// Share of his NBA team's games he'll play: what he played this season and
// the last two, pulled toward a typical share. A season he missed entirely
// (a rookie, or out of the league) says nothing either way.
function playShare(
  played: [number, number][],
  { priorWeights, playWeight, usualPlay }: ProjectionOptions,
) {
  let games = 0;
  let of = 0;
  played.forEach(([g, total], i) => {
    const w = i === 0 ? 1 : (priorWeights[i - 1] ?? 0);
    games += w * Math.min(g, total);
    of += w * total;
  });
  return (games + playWeight * usualPlay) / (of + playWeight);
}

// Rostered players run about thirteen deep on fifteen teams: the per-game
// line of last season's players ranked around the end of that, among those
// who played a quarter of the season
const BASELINE_RANKS = [150, 210];
function baselineLine(pool: PlayerPool | undefined, rates: PointRates) {
  const most = Math.max(0, ...(pool?.players ?? []).map((p) => p[1]));
  const lines = (pool?.players ?? [])
    .filter((p) => p[1] >= most / 4)
    .map((p) => ({ games: p[1], stats: statsOf(p)! }))
    .sort((a, b) => linePoints(b.stats, rates) - linePoints(a.stats, rates))
    .slice(...BASELINE_RANKS);
  const games = lines.reduce((s, l) => s + l.games, 0);
  const total = emptyLine();
  for (const l of lines) addLine(total, l.stats);
  return games ? total.map((v) => v / games) : emptyLine();
}

const scale = (line: StatLine, by: number) => line.map((v) => v * by);

function standings(lines: Map<number, StatLine>) {
  const scored = scoreRoto(lines);
  return new Map<number, Standing>(
    scored.map((t) => [
      t.id,
      {
        points: t.points,
        rank: 1 + scored.filter((o) => o.points > t.points + 1e-9).length,
        categories: t.categories,
      },
    ]),
  );
}

// Out: ESPN lists him out, or he has missed two or more of his NBA team's
// games in a row
export const isOut = (p: { out: number; status?: string }) => p.status === 'OUT' || p.out >= 2;

const byProjected = (a: { projectedValue: number }, b: { projectedValue: number }) =>
  b.projectedValue - a.projectedValue;

// A roster's projected nine: the best rest-of-season values, IR left out
export function lineup<T extends { slot: number; projectedValue: number }>(players: T[], starters: number) {
  return players.filter((p) => p.slot !== IR).sort(byProjected).slice(0, starters);
}

export function restOf(players: { restLine: StatLine }[]) {
  const line = emptyLine();
  for (const p of players) addLine(line, p.restLine);
  return line;
}

export function buildRosters({
  league,
  days,
  names,
  proTeams,
  schedule,
  pool,
  priors,
  rates,
  options = PROJECTION,
  espn = {},
  rotowire = {},
}: RosterInput): RosterModel {
  const sorted = [...days].sort((a, b) => a.day - b.day);
  const byDay = new Map(sorted.map((d) => [d.day, d]));
  const today = league.latestDay;
  const latest = [...sorted].reverse().find((d) => d.rosters && d.slots);
  const rosters = latest?.rosters ?? {};
  const slots = latest?.slots ?? {};

  const playedOn = new Map<number, Set<number>>();
  for (const d of sorted) playedOn.set(d.day, new Set(d.players.filter((p) => p[3] > 0).map((p) => p[1])));
  const playedToday = playedOn.get(today) ?? new Set<number>();
  const scheduled = new Map(Object.entries(schedule).map(([team, ds]) => [Number(team), new Set(ds)]));

  // His NBA team's games from `from` through `to`, today's only if he hasn't
  // played yet (its stats are already in the totals)
  const gamesBetween = (id: number, from: number, to: number) => {
    const pro = proTeams[id];
    const ds = pro ? schedule[pro] : undefined;
    if (!ds) return 0;
    let n = ds.filter((d) => d > today && d >= from && d <= to).length;
    if (from <= today && to >= today && scheduled.get(pro)?.has(today) && !playedToday.has(id)) n++;
    return n;
  };

  // Everyone on any roster this season, for the trend
  const ever = new Set<number>();
  for (const d of sorted) for (const ids of Object.values(d.rosters ?? {})) ids.forEach((id) => ever.add(id));

  const byName = (p: PlayerPool | undefined) => new Map((p?.players ?? []).map((x) => [x[0], x]));
  const current = byName(pool);
  const past = priors.slice(0, 2).map(byName);
  const pastLength = priors.slice(0, 2).map(seasonGames);
  const baseline = baselineLine(priors[0], rates);
  // His NBA team's games so far, today's if he has played it
  const teamGamesSoFar = (id: number) => {
    const pro = proTeams[id];
    const ds = pro ? schedule[pro] : undefined;
    return (ds ?? []).filter((d) => d < today).length + (playedToday.has(id) ? 1 : 0);
  };

  const info = new Map<number, Omit<RosterPlayer, 'team' | 'slot' | 'seasonRank' | 'projectedRank' | 'starter' | 'out'>>();
  for (const id of ever) {
    const name = names[id] ?? `Player ${id}`;
    const own = current.get(name);
    const seasonLine = statsOf(own) ?? emptyLine();
    const perGame = blend(own, past.map((m) => m.get(name)), baseline, options);
    const remaining = gamesBetween(id, today, league.finalDay);
    const history: [number, number][] = [[own?.[1] ?? 0, teamGamesSoFar(id)]];
    past.forEach((m, i) => {
      const p = m.get(name);
      history.push(p ? [p[1], pastLength[i]] : [0, 0]);
    });
    // ESPN's games left (its season projection less the games played so
    // far) as a share of the team's, where ESPN has one
    const validGames = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    const rwGames = rotowire[id];
    const espnGames = validGames(rwGames) ? rwGames : espn[id]?.[0];
    const availability =
      validGames(espnGames) && remaining > 0
        ? Math.min(1, Math.max(0, espnGames - (own?.[1] ?? 0)) / remaining)
        : playShare(history, options);
    const restLine = perGame ? scale(perGame, remaining * availability) : emptyLine();
    info.set(id, {
      id,
      name,
      proTeam: proTeams[id],
      games: own?.[1] ?? 0,
      seasonLine,
      seasonValue: own ? linePoints(seasonLine, rates) : 0,
      perGame,
      remaining,
      availability,
      availabilitySource: validGames(rwGames) ? 'RotoWire' : validGames(espnGames) ? 'ESPN' : 'History',
      restLine,
      projectedValue: perGame ? linePoints(restLine, rates) : 0,
    });
  }

  const outStreak = (id: number, team: string) => {
    if (playedToday.has(id)) return 0;
    let n = 0;
    for (let d = today - 1; d >= 1; d--) {
      const day = byDay.get(d);
      if (!day?.rosters?.[team]?.includes(id) || playedOn.get(d)?.has(id)) break;
      const pro = day.playedFor?.[id] ?? proTeams[id];
      if (pro && scheduled.get(pro)?.has(d)) n++;
    }
    return n;
  };

  // How each player came to his current team: the latest add or trade, else
  // the auction
  const events: [number, string, Acquired][] = league.draft.map((pick) => [
    0,
    `${pick.team}:${pick.playerID}`,
    { how: 'draft', price: pick.price, keeper: pick.keeper },
  ]);
  for (const d of sorted) {
    for (const t of d.tx) {
      for (const [kind, pid, , to] of t.items) {
        if (kind === 'ADD') events.push([d.day, `${to}:${pid}`, { how: t.type === 'WAIVER' ? 'waiver' : 'free agent', bid: t.bid, day: d.day }]);
      }
    }
  }
  for (const trade of inferTrades(sorted)) {
    for (const [pid, , to] of trade.moves) events.push([trade.day, `${to}:${pid}`, { how: 'trade', day: trade.day }]);
  }
  events.sort((a, b) => a[0] - b[0]);
  const acquired = new Map(events.map(([, key, how]) => [key, how]));

  const players: RosterPlayer[] = [];
  for (const [team, ids] of Object.entries(rosters)) {
    for (const id of ids) {
      players.push({
        ...info.get(id)!,
        team: Number(team),
        slot: slots[id] ?? BENCH,
        seasonRank: 0,
        projectedRank: 0,
        starter: false,
        out: outStreak(id, team),
        status: espn[id]?.[1],
        acquired: acquired.get(`${team}:${id}`),
      });
    }
  }
  [...players].filter((p) => p.games > 0).sort((a, b) => b.seasonValue - a.seasonValue).forEach((p, i) => (p.seasonRank = i + 1));
  [...players].sort(byProjected).forEach((p, i) => (p.projectedRank = i + 1));

  const starters = Math.max(
    1,
    ...Object.values(rosters).map((ids) => ids.filter((id) => isStarterSlot(slots[id])).length),
  );
  const teamIDs = league.teams.map((t) => t.id);
  const teamPlayers = new Map(teamIDs.map((id) => [id, players.filter((p) => p.team === id).sort(byProjected)]));
  const nine = new Map(teamIDs.map((id) => [id, lineup(teamPlayers.get(id)!, starters)]));
  for (const ps of nine.values()) for (const p of ps) p.starter = true;

  const totals = new Map(league.teams.map((t) => [t.id, t.totals]));
  const rest = new Map(teamIDs.map((id) => [id, restOf(nine.get(id)!)]));
  const roster = standings(rest);
  const now = standings(totals);
  const finish = standings(new Map(teamIDs.map((id) => [id, addLine([...totals.get(id)!], rest.get(id)!)])));

  // Trend: each day's roster, every player at today's projection
  const trendDays = sorted.filter((d) => d.rosters && d.day <= today).map((d) => d.day);
  const trend = new Map(teamIDs.map((id) => [id, [] as number[]]));
  for (const day of trendDays) {
    const d = byDay.get(day)!;
    const lines = new Map<number, StatLine>();
    for (const id of teamIDs) {
      const ps = (d.rosters![id] ?? []).map((pid) => ({ ...info.get(pid)!, slot: d.slots?.[pid] ?? BENCH }));
      lines.set(id, restOf(lineup(ps, starters)));
    }
    for (const [id, s] of standings(lines)) trend.get(id)?.push(s.points);
  }

  const sum = (ps: RosterPlayer[]) => ps.reduce((s, p) => s + p.projectedValue, 0);
  const teams: TeamStrength[] = teamIDs
    .map((id) => {
      const ps = teamPlayers.get(id)!;
      return {
        id,
        players: ps,
        roster: roster.get(id)!,
        now: now.get(id)!,
        finish: finish.get(id)!,
        starters: sum(ps.filter((p) => p.starter)),
        bench: sum(ps.filter((p) => !p.starter && p.slot !== IR)),
        ir: sum(ps.filter((p) => p.slot === IR)),
        lineup: sum(ps.filter((p) => isStarterSlot(p.slot))),
        available: sum(lineup(ps.filter((p) => !isOut(p)), starters)),
        trend: trend.get(id)!,
      };
    })
    .sort((a, b) => b.roster.points - a.roster.points || b.starters - a.starters);

  return { teams, players, days: trendDays, starters, totals, rates };
}

// A player's per-game line for display: this season's, or the blend
export function perGameLine(p: RosterPlayer, basis: 'season' | 'projected') {
  if (basis === 'projected') return p.perGame;
  return p.games ? p.seasonLine.map((v) => v / p.games) : null;
}

// Each category's value per game, for the heat cells
export const perGameCategories = (line: StatLine, rates: PointRates) => categoryPoints(line, rates);
