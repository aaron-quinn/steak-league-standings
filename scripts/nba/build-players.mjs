// Builds public/nba-data/<season>/players.json for finished seasons: every NBA
// player's season totals, for the per-game player comps on the categories
// standings. The live season's come from the Worker (/api/nba/players/:year).
//
// ESPN's public players endpoint returns every game too (about 25 MB a
// season), so responses are kept gzipped in .cache/nba-espn/ like
// build-seasons.mjs does.
// Usage: node scripts/nba/build-players.mjs [season ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CURRENT_SEASON } from '../../worker/nba/config.js';
import { PLAYERS_FILTER, PUBLIC_PLAYERS, compactPlayers } from '../../worker/nba/espn.js';

const CACHE = '.cache/nba-espn';
const OUT = 'public/nba-data';
// 2018 (Yahoo) has no games played, so no per-game view
const ESPN_FIRST_SEASON = 2019;

async function players(season) {
  const path = `${CACHE}/players-${season}.json.gz`;
  if (existsSync(path)) return JSON.parse(gunzipSync(readFileSync(path)));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(PUBLIC_PLAYERS(season), {
      headers: { Accept: 'application/json', 'X-Fantasy-Filter': PLAYERS_FILTER(season) },
    });
    if (res.ok) {
      const text = await res.text();
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(path, gzipSync(text));
      return JSON.parse(text);
    }
    if (attempt === 4) throw new Error(`${res.status} from ${PUBLIC_PLAYERS(season)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const seasons = process.argv.slice(2).map(Number);
for (const season of seasons.length
  ? seasons
  : Array.from({ length: CURRENT_SEASON - ESPN_FIRST_SEASON }, (_, i) => ESPN_FIRST_SEASON + i)) {
  const data = compactPlayers(await players(season), season);
  mkdirSync(`${OUT}/${season}`, { recursive: true });
  const text = JSON.stringify(data);
  writeFileSync(`${OUT}/${season}/players.json`, text);
  console.log(`${season}: ${data.players.length} players, ${Math.round(text.length / 1024)} KB`);
}
