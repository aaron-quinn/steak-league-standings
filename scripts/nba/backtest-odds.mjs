// Leave-one-season-out backtest of the NBA steak odds (src/nba/lib/odds.ts)
// against a baseline that only knows each team's current position.
// Scores per team-week log loss on eating, and calibration by decile.
// Each run compares paces per calendar day with paces per game played.
// Usage: node scripts/nba/backtest-odds.mjs [priorDays ...] [--early]
import { readFileSync } from 'node:fs';
import {
  GAMES_PRIOR_DAYS,
  checkpoints,
  fitModel,
  seeded,
  simulate,
} from '../../src/nba/lib/odds.ts';
import { scoreRoto } from '../../src/nba/lib/roto.ts';

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const load = (season) => {
  const totals = JSON.parse(readFileSync(`public/nba-data/${season}/totals.json`, 'utf8'));
  const league = JSON.parse(readFileSync(`public/nba-data/${season}/league.json`, 'utf8'));
  const name = (t) => t.owner || t.name;
  const order = new Map(
    [...league.teams].sort((a, b) => name(a).localeCompare(name(b))).map((t, i) => [t.id, i]),
  );
  return { season, ...totals, lastDay: league.lastDay, order };
};
const seasons = SEASONS.map(load);

// Who ate, from final totals, ties by name like the standings
function eaters(final, order) {
  const ranked = scoreRoto(final).sort((a, b) => b.points - a.points || order.get(a.id) - order.get(b.id));
  return new Set(ranked.slice(0, Math.floor(ranked.length / 2)).map((t) => t.id));
}

const clamp = (p) => Math.min(1 - 1e-3, Math.max(1e-3, p));
const loss = (p, y) => -(y ? Math.log(clamp(p)) : Math.log(1 - clamp(p)));

// Baseline: share of teams at this position, with this much season left, that ate
function positionBaseline(train) {
  const counts = new Map();
  for (const s of train) {
    for (const { soFar, final } of checkpoints(s)) {
      const ate = eaters(final, s.order);
      const n = soFar.totals.size;
      const ranked = scoreRoto(soFar.totals).sort((a, b) => b.points - a.points || s.order.get(a.id) - s.order.get(b.id));
      const left = Math.round((4 * soFar.remaining) / s.lastDay);
      ranked.forEach((t, i) => {
        const key = `${left}:${Math.round((10 * i) / n)}`;
        const c = counts.get(key) ?? [1, 2];
        c[0] += ate.has(t.id); c[1]++;
        counts.set(key, c);
      });
    }
  }
  return (soFar, s, index) => {
    const left = Math.round((4 * soFar.remaining) / s.lastDay);
    const c = counts.get(`${left}:${Math.round((10 * index) / soFar.totals.size)}`) ?? [1, 2];
    return c[0] / c[1];
  };
}

// Weekly checkpoints, as the model is fitted; --early instead scores each of a
// season's first seven days with games (opening night on), where schedule luck
// is largest
const early = process.argv.includes('--early');
const heldCheckpoints = (season) =>
  early ? checkpoints(season, 1, 0).slice(0, 7) : checkpoints(season);

// --games-prior=7,14,28 scans the days of league-average games blended into a
// team's own games per day (GAMES_PRIOR_DAYS in odds.ts)
const gamesPriorArg = process.argv.find((a) => a.startsWith('--games-prior='));
const gamesPriors = gamesPriorArg
  ? gamesPriorArg.split('=')[1].split(',').map(Number)
  : [GAMES_PRIOR_DAYS];
const modes = [{ perGame: false }, ...gamesPriors.map((g) => ({ perGame: true, gamesPrior: g }))];

const priors = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
for (const priorDays of priors.length ? priors : [14])
for (const { perGame, gamesPrior } of modes) {
  let model = 0, base = 0, count = 0;
  const bins = Array.from({ length: 10 }, () => [0, 0, 0]);
  const buried = [0, 0];
  const bySeason = [];
  for (const held of seasons) {
    const train = seasons.filter((s) => s !== held);
    const fitted = fitModel(train, priorDays, perGame, gamesPrior);
    const baseline = positionBaseline(train);
    let sm = 0, sb = 0, sc = 0;
    for (const { soFar, final } of heldCheckpoints(held)) {
      const ate = eaters(final, held.order);
      const odds = simulate(soFar, fitted, held.order, 400, seeded(held.season * 1000 + soFar.elapsed));
      const ranked = scoreRoto(soFar.totals).sort((a, b) => b.points - a.points || held.order.get(a.id) - held.order.get(b.id));
      ranked.forEach((t, i) => {
        const y = ate.has(t.id);
        const p = odds.get(t.id).eat;
        sm += loss(p, y); sb += loss(baseline(soFar, held, i), y); sc++;
        const bin = bins[Math.min(9, Math.floor(p * 10))];
        bin[0] += p; bin[1] += y; bin[2]++;
        // The page's tombstone line
        if (p < 0.01) { buried[0]++; buried[1] += y; }
      });
    }
    model += sm; base += sb; count += sc;
    bySeason.push(`${held.season} ${(sm / sc).toFixed(3)} vs ${(sb / sc).toFixed(3)}`);
    if (priors.length <= 1 && perGame && held === seasons.at(-1)) {
      console.log('fitted on 2019–2025:', JSON.stringify(fitted, (_key, v) => (typeof v === 'number' ? +v.toFixed(4) : v)));
    }
  }
  console.log(`priorDays ${priorDays}, ${perGame ? `per game, games prior ${gamesPrior} days` : 'per day'}${early ? ', first 7 days' : ''}: model ${(model / count).toFixed(4)}, position baseline ${(base / count).toFixed(4)} (${count} team-checkpoints)`);
  console.log('  by season (model vs baseline):', bySeason.join(' · '));
  console.log(`  under 1% (tombstoned): ${buried[0]} team-weeks, ${buried[1]} ate`);
  console.log('  calibration (predicted → ate, n):', bins.filter((b) => b[2]).map((b) => `${(100 * b[0] / b[2]).toFixed(0)}→${(100 * b[1] / b[2]).toFixed(0)} (${b[2]})`).join('  '));
}
