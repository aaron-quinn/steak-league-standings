// Steak odds for a roto season: simulate every team's rest of season, score
// each simulated finish with roto points, and count how often each team ends
// up eating. Imports only roto.ts (with its extension) so the backtest in
// scripts/nba/ can load this file straight into Node.
import { CATEGORIES, addLine, emptyLine, scoreRoto, type StatLine } from './roto.ts';

// Stat line indexes. Counting stats, then the two shooting volumes.
const COUNTING = [0, 1, 2, 3, 4, 5];
const VOLUME = [7, 9]; // FGA, FTA
const MADE = [6, 8]; // FGM, FTM

// How far a team's production strays from its pace over R remaining days.
// Relative error sd = sqrt(drift² + noise / R): drift is real change in a
// team (injuries, trades, minutes); noise is day-to-day luck.
export interface ErrorModel {
  drift: number;
  noise: number;
}

export interface OddsModel {
  // Days of league-average production blended into a team's pace
  priorDays: number;
  // Active-lineup games a team plays per calendar day, on average. When set,
  // paces are per game played times the games a team is expected to get, so
  // early schedule luck (more games so far) isn't projected forward
  gamesPerDay?: number;
  // Days of league-average games blended into a team's own games per day.
  // Over a season some teams really do get more games (streaming, full
  // lineups), so their own rate takes over as the days pass.
  gamesPriorDays?: number;
  // One per counting stat (PTS, REB, AST, 3PM, STL, BLK), then FGA, FTA
  volume: ErrorModel[];
  // Absolute error of FG% and FT% over the remaining shots
  shooting: ErrorModel[];
  // How much of a team's luck is shared across its categories
  teamShare: number;
}

export interface SeasonSoFar {
  // Each team's total through today
  totals: Map<number, StatLine>;
  // Each team's active-lineup games through today, when known
  games?: Map<number, number>;
  // Calendar days played and left (day 1 is opening night)
  elapsed: number;
  remaining: number;
}

const sd = (e: ErrorModel, remaining: number) =>
  Math.sqrt(e.drift ** 2 + e.noise / Math.max(remaining, 1));

// Each team's expected production per remaining day, nudged toward the
// league average while the sample is small. With games known, that's the
// team's production per game times the games per day it's expected to get.
function paces(
  season: SeasonSoFar,
  priorDays: number,
  gamesPerDay?: number,
  gamesPriorDays = 0,
) {
  const ids = [...season.totals.keys()];
  const league = emptyLine();
  for (const id of ids) addLine(league, season.totals.get(id)!);
  const games = season.games;
  const leagueGames = games ? ids.reduce((sum, id) => sum + (games.get(id) ?? 0), 0) : 0;
  if (gamesPerDay && games && leagueGames > 0) {
    const perGame = league.map((v) => v / leagueGames);
    const priorGames = priorDays * gamesPerDay;
    return new Map(
      ids.map((id) => {
        const played = games.get(id) ?? 0;
        const rate = (played + gamesPriorDays * gamesPerDay) / (season.elapsed + gamesPriorDays);
        const weight = played + priorGames;
        return [
          id,
          season.totals.get(id)!.map((v, i) => ((v + priorGames * perGame[i]) / weight) * rate),
        ];
      }),
    );
  }
  const average = league.map((v) => v / ids.length / Math.max(season.elapsed, 1));
  const weight = season.elapsed + priorDays;
  return new Map(
    ids.map((id) => [
      id,
      season.totals.get(id)!.map((v, i) => (v + priorDays * average[i]) / weight),
    ]),
  );
}

// Shooting percentage a team is expected to make the rest of the way
const pct = (line: StatLine, made: number, tried: number) =>
  line[tried] ? line[made] / line[tried] : 0;

// A standard normal draw
function gaussian(random: () => number) {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

// A small seeded generator, so the odds don't flicker between renders
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TeamOdds {
  id: number;
  eat: number;
  first: number;
  // Average simulated finish (1 = first) and roto points
  position: number;
  points: number;
}

// `order` breaks ties in points the same way the standings do (by name)
export function simulate(
  season: SeasonSoFar,
  model: OddsModel,
  order: Map<number, number>,
  runs = 2000,
  random = seeded(1),
): Map<number, TeamOdds> {
  const ids = [...season.totals.keys()];
  const n = ids.length;
  const eaters = Math.floor(n / 2);
  const pace = paces(season, model.priorDays, model.gamesPerDay, model.gamesPriorDays);
  const R = season.remaining;
  const result = new Map<number, TeamOdds>(
    ids.map((id) => [id, { id, eat: 0, first: 0, position: 0, points: 0 }]),
  );

  const volumeSD = model.volume.map((e) => sd(e, R));
  const shootingSD = model.shooting.map((e) => sd(e, R));
  const share = Math.sqrt(model.teamShare);
  const own = Math.sqrt(1 - model.teamShare);

  for (let run = 0; run < runs; run++) {
    const finals = new Map<number, StatLine>();
    for (const id of ids) {
      const final = [...season.totals.get(id)!];
      const p = pace.get(id)!;
      const team = gaussian(random);
      const factor = (i: number) =>
        Math.max(0, 1 + volumeSD[i] * (share * team + own * gaussian(random)));
      COUNTING.forEach((stat, i) => (final[stat] += p[stat] * R * factor(i)));
      VOLUME.forEach((tried, i) => {
        const made = MADE[i];
        const shots = p[tried] * R * factor(COUNTING.length + i);
        const rate = Math.min(
          1,
          Math.max(0, pct(p, made, tried) + shootingSD[i] * gaussian(random)),
        );
        final[tried] += shots;
        final[made] += shots * rate;
      });
      finals.set(id, final);
    }
    const ranked = scoreRoto(finals).sort(
      (a, b) => b.points - a.points || order.get(a.id)! - order.get(b.id)!,
    );
    ranked.forEach((team, i) => {
      const odds = result.get(team.id)!;
      if (i < eaters) odds.eat++;
      if (i === 0) odds.first++;
      odds.position += i + 1;
      odds.points += team.points;
    });
  }
  for (const odds of result.values()) {
    odds.eat /= runs;
    odds.first /= runs;
    odds.position /= runs;
    odds.points /= runs;
  }
  return result;
}

// A finished season's daily totals, as the model learns from them
export interface PastSeason {
  days: number[];
  teams: Record<string, StatLine[]>;
  // Active-lineup games each team played each day (files built since Oct 2026)
  games?: Record<string, number[]>;
  // The last day that counted
  lastDay: number;
}

// Cumulative totals (and games, when known) through each day index
function cumulative(season: PastSeason) {
  const ids = Object.keys(season.teams).map(Number);
  const running = new Map(ids.map((id) => [id, emptyLine()]));
  const played = new Map(ids.map((id) => [id, 0]));
  return season.days.map((_, i) => {
    for (const id of ids) {
      addLine(running.get(id)!, season.teams[id][i]);
      played.set(id, played.get(id)! + (season.games?.[id]?.[i] ?? 0));
    }
    return {
      totals: new Map([...running].map(([id, line]) => [id, [...line]])),
      games: season.games ? new Map(played) : undefined,
    };
  });
}

// Checkpoints through a past season, every `every` days of games from day
// index `first`: totals (and games) so far, and final totals
export function checkpoints(season: PastSeason, every = 7, first = every - 1) {
  const running = cumulative(season);
  const out: { soFar: SeasonSoFar; final: Map<number, StatLine> }[] = [];
  // 2017-18 (Yahoo) has no daily totals
  if (!running.length) return out;
  const final = running[running.length - 1].totals;
  for (let i = first; i < season.days.length - 1; i += every) {
    const day = season.days[i];
    out.push({
      soFar: { ...running[i], elapsed: day, remaining: season.lastDay - day },
      final,
    });
  }
  return out;
}

// Chosen by scripts/nba/backtest-odds.mjs --games-prior=0,3,7,14,28,56,
// leaving each season out (log loss; per day was 0.3912 weekly, 0.6653 over
// the first seven days): 28 gave 0.3900 weekly and 0.6367 early. Less trusts
// early schedule luck (0 scored 1.087 early); more ignores real differences
// in games later on (56: 0.3917 weekly).
export const GAMES_PRIOR_DAYS = 28;

// Active-lineup games per team per calendar day over the seasons that record
// games, or undefined if none do
function averageGamesPerDay(seasons: PastSeason[]) {
  let games = 0;
  let teamDays = 0;
  for (const season of seasons) {
    if (!season.games) continue;
    const ids = Object.keys(season.games);
    for (const id of ids) games += season.games[id].reduce((a, b) => a + b, 0);
    teamDays += ids.length * season.lastDay;
  }
  return teamDays ? games / teamDays : undefined;
}

// Fits the error model to past seasons: compare each team's pace at every
// weekly checkpoint with what it actually produced over the rest of the season.
// perGame (the default) projects per game played when the seasons record games.
export function fitModel(
  seasons: PastSeason[],
  priorDays = 14,
  perGame = true,
  gamesPriorDays = GAMES_PRIOR_DAYS,
): OddsModel {
  const gamesPerDay = perGame ? averageGamesPerDay(seasons) : undefined;
  const volumeRows = COUNTING.length + VOLUME.length;
  const volume: { R: number; err: number }[][] = Array.from({ length: volumeRows }, () => []);
  const shooting: { R: number; err: number }[][] = [[], []];
  const teamResiduals: number[][] = [];

  for (const season of seasons) {
    for (const { soFar, final } of checkpoints(season)) {
      const pace = paces(soFar, priorDays, gamesPerDay, gamesPriorDays);
      const R = soFar.remaining;
      if (R < 3) continue;
      for (const [id, now] of soFar.totals) {
        const end = final.get(id)!;
        const p = pace.get(id)!;
        const residuals: number[] = [];
        [...COUNTING, ...VOLUME].forEach((stat, i) => {
          const expected = p[stat] * R;
          if (expected <= 0) return;
          const err = (end[stat] - now[stat]) / expected - 1;
          volume[i].push({ R, err });
          if (i < COUNTING.length) residuals.push(err);
        });
        VOLUME.forEach((tried, i) => {
          const made = MADE[i];
          const shots = end[tried] - now[tried];
          if (shots <= 0) return;
          shooting[i].push({
            R,
            err: (end[made] - now[made]) / shots - pct(p, made, tried),
          });
        });
        teamResiduals.push(residuals);
      }
    }
  }

  return {
    priorDays,
    gamesPerDay,
    gamesPriorDays,
    volume: volume.map(fitError),
    shooting: shooting.map(fitError),
    teamShare: sharedShare(teamResiduals),
  };
}

// Least squares for err² = drift² + noise / R
function fitError(rows: { R: number; err: number }[]): ErrorModel {
  if (rows.length < 10) return { drift: 0.1, noise: 1 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const { R, err } of rows) {
    const x = 1 / R;
    const y = err * err;
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const n = rows.length;
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  return { drift: Math.sqrt(Math.max(intercept, 1e-6)), noise: Math.max(slope, 0) };
}

// Average correlation between a team's errors in different categories
function sharedShare(rows: number[][]) {
  const k = COUNTING.length;
  const full = rows.filter((r) => r.length === k);
  if (full.length < 10) return 0.5;
  const mean = Array.from({ length: k }, (_, i) => full.reduce((s, r) => s + r[i], 0) / full.length);
  const sdv = Array.from({ length: k }, (_, i) =>
    Math.sqrt(full.reduce((s, r) => s + (r[i] - mean[i]) ** 2, 0) / full.length),
  );
  let total = 0, pairs = 0;
  for (let a = 0; a < k; a++) {
    for (let b = a + 1; b < k; b++) {
      const cov = full.reduce((s, r) => s + (r[a] - mean[a]) * (r[b] - mean[b]), 0) / full.length;
      total += cov / (sdv[a] * sdv[b]);
      pairs++;
    }
  }
  return Math.min(0.95, Math.max(0, total / pairs));
}

export { CATEGORIES };
