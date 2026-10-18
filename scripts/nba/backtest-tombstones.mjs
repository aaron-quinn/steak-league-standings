// Leave-one-season-out check of the tombstone rule (src/nba/lib/tombstone.ts):
// at every week of each season, with the line drawn from the other seasons,
// how many teams were buried and how many of them ate anyway.
// Usage: npx esbuild scripts/nba/backtest-tombstones.mjs --bundle --platform=node
//          --format=esm --outfile=/tmp/backtest-tombstones.mjs && node /tmp/backtest-tombstones.mjs
import { readFileSync } from 'node:fs';
import { buildRace } from '../../src/nba/lib/race';
import { modelFor, oddsHistory } from '../../src/nba/lib/season-odds';
import { tombstoneLine, tombstoned } from '../../src/nba/lib/tombstone';

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const races = SEASONS.map((season) => {
  const league = JSON.parse(readFileSync(`public/nba-data/${season}/league.json`, 'utf8'));
  const totals = JSON.parse(readFileSync(`public/nba-data/${season}/totals.json`, 'utf8'));
  return { season, race: buildRace(league, totals) };
});

// The odds model, also fitted without the held-out season, for comparison
const history = SEASONS.map((season) => {
  const league = JSON.parse(readFileSync(`public/nba-data/${season}/league.json`, 'utf8'));
  const totals = JSON.parse(readFileSync(`public/nba-data/${season}/totals.json`, 'utf8'));
  return { season, league, totals, lastDay: league.lastDay };
});

const rules = {
  'history line': () => true,
  'history line and odds under 5%': (p) => p < 0.05,
  'odds under 1% alone': null,
};
const counts = Object.fromEntries(Object.keys(rules).map((k) => [k, { buried: 0, ate: 0, misses: [] }]));
for (const held of races) {
  const line = tombstoneLine(races.filter((r) => r !== held));
  const h = history.find((x) => x.season === held.season);
  const odds = oddsHistory(h.league, h.totals, modelFor(held.season, history), h.lastDay, 400);
  const { race } = held;
  const end = race.checkpoints.length - 1;
  for (let week = 0; week < end; week++) {
    const buriedNow = tombstoned(race, week, line);
    for (const team of race.teams) {
      const p = odds.eat.get(team.id)[week];
      const ate = team.zones[end] === 'eater';
      for (const [name, test] of Object.entries(rules)) {
        const hit = test ? buriedNow.has(team.id) && test(p) : p < 0.01;
        if (!hit) continue;
        counts[name].buried++;
        if (ate) {
          counts[name].ate++;
          counts[name].misses.push(`${team.name} ${held.season} (${end - week} weeks left, odds ${Math.round(p * 100)}%)`);
        }
      }
    }
  }
}
for (const [name, c] of Object.entries(counts)) {
  console.log(`${name}: buried ${c.buried} team-weeks, ${c.ate} ate`);
  if (c.misses.length) console.log('  ate anyway:', c.misses.join(', '));
}
