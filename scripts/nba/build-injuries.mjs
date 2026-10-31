// Builds each finished season's absences into public/nba-data/<season>/injuries.json
// for the Injuries screen (src/nba/lib/injuries.ts). days.json drops the daily
// lineup slots and NBA teams it needs, so this reads the ESPN responses that
// build-seasons.mjs keeps in .cache/nba-espn/ and makes no requests: run that
// first for a season missing from the cache.
// Usage: npm run nba:injuries [season ...]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { compactDay, compactSchedule } from '../../worker/nba/espn.js';
import { buildInjuryData } from '../../src/nba/lib/injuries';
import { CURRENT_SEASON } from '../../src/nba/lib/season';

const CACHE = '.cache/nba-espn';
const OUT = 'public/nba-data';
const ESPN_FIRST_SEASON = 2019;

const cached = (season, file) => {
  const path = `${CACHE}/${season}/${file}.json.gz`;
  if (!existsSync(path)) throw new Error(`${path} is missing: run scripts/nba/build-seasons.mjs ${season} first`);
  return JSON.parse(gunzipSync(readFileSync(path)));
};
const stored = (season, file) => {
  const path = `${OUT}/${season}/${file}`;
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
};

function build(season) {
  const league = stored(season, 'league.json');
  const days = [];
  const names = {};
  const proTeams = {};
  for (let day = 1; day <= league.lastDay; day++) {
    const d = compactDay(cached(season, `day-${day}`), day);
    Object.assign(names, d.names);
    Object.assign(proTeams, d.proTeams);
    days.push(d);
  }
  const data = buildInjuryData({
    days,
    schedule: compactSchedule(cached(season, 'schedule')),
    through: league.lastDay,
    names,
    proTeams,
    priors: [season - 1, season - 2].map((s) => stored(s, 'players.json')).filter(Boolean),
  });
  writeFileSync(`${OUT}/${season}/injuries.json`, JSON.stringify(data));
  const kb = Math.round(JSON.stringify(data).length / 1024);
  console.log(`${season}: ${data.misses.length} rostered games missed, ${kb} KB`);
}

const seasons = process.argv.slice(2).map(Number);
for (const season of seasons.length
  ? seasons
  : Array.from({ length: CURRENT_SEASON - ESPN_FIRST_SEASON }, (_, i) => ESPN_FIRST_SEASON + i)) {
  build(season);
}
