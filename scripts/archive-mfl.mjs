// Saves finished seasons' MFL exports to public/mfl, where the Worker reads
// them instead of asking MFL. Run after a season ends:
//
//   node scripts/archive-mfl.mjs            every finished season
//   node scripts/archive-mfl.mjs 2019 2020  just these
//   node scripts/archive-mfl.mjs --force    refetch files already saved
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getDefaults, { leaguesFor } from '../worker/utils/get-defaults.js';
import { archivePath, seasonExports } from '../worker/utils/mfl-archive.js';

const FIRST_SEASON = 2016;
// MFL answers a burst of requests with a plain "No", so go slowly
const PAUSE_MS = 2000;

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const args = process.argv.slice(2);
const force = args.includes('--force');
const lastFinished = Number(getDefaults().season) - 1;
const seasons = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
if (seasons.some((s) => s > lastFinished)) {
  console.error(`Only finished seasons (through ${lastFinished}) are archived`);
  process.exit(1);
}
if (seasons.length === 0) {
  for (let s = FIRST_SEASON; s <= lastFinished; s++) seasons.push(s);
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(url) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(`https://api.myfantasyleague.com${url}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'axios/1.7.9' },
    });
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data.error) throw new Error(JSON.stringify(data.error));
      return text;
    } catch (error) {
      console.warn(`  retrying (${attempt}): ${error.message.slice(0, 80)}`);
      await pause(PAUSE_MS * 5 * attempt);
    }
  }
  throw new Error(`Gave up on ${url}`);
}

let saved = 0;
let failed = 0;
for (const season of seasons) {
  const ids = leaguesFor(season).map((league) => league.id);
  for (const url of seasonExports(season, ids)) {
    const file = join(root, archivePath(url));
    if (existsSync(file) && !force) continue;
    try {
      const text = await download(url);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
      saved++;
      console.log(`saved ${archivePath(url)}`);
    } catch (error) {
      failed++;
      console.error(error.message);
    }
    await pause(PAUSE_MS);
  }
}
console.log(`${saved} saved, ${failed} failed`);
process.exit(failed ? 1 : 0);
