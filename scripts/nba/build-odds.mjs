// Fits the Steak Odds model and draws the tombstone line for every season,
// each from the other finished seasons, into public/nba-data/odds.json. Both
// only depend on finished seasons, so the site reads them from here instead of
// downloading every past season's totals to fit them in the browser.
//
// npm run build runs this, so a model change or a rebuilt season ships with a
// fresh file. The output is deterministic: an unchanged model rewrites the
// same bytes.
// Usage: npm run nba:odds
import { readFileSync, writeFileSync } from 'node:fs';
import { buildRace } from '../../src/nba/lib/race';
import { modelFor } from '../../src/nba/lib/season-odds';
import { SEASONS, isFinished } from '../../src/nba/lib/season';
import { tombstoneLine } from '../../src/nba/lib/tombstone';

const read = (season, file) =>
  JSON.parse(readFileSync(`public/nba-data/${season}/${file}`, 'utf8'));

// Newest first, the order the site fitted them in: the line keeps the first of
// two equal comebacks, so the order decides which one it names
const past = SEASONS.filter(isFinished)
  .map((season) => {
    const league = read(season, 'league.json');
    const totals = read(season, 'totals.json');
    return { season, league, totals, lastDay: league.lastDay };
  });
const races = past.map((p) => ({ season: p.season, race: buildRace(p.league, p.totals) }));

const out = {};
for (const season of SEASONS) {
  out[season] = {
    model: modelFor(season, past),
    line: tombstoneLine(races.filter((r) => r.season !== season)),
  };
}
writeFileSync('public/nba-data/odds.json', JSON.stringify(out));
console.log(`Wrote public/nba-data/odds.json for ${SEASONS.length} seasons`);
