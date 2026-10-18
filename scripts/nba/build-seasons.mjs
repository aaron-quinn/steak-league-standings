// Builds the NBA Steak League's finished seasons into public/nba-data/<season>/ so
// the site never asks ESPN about them:
//   league.json  teams, owners, totals through the last day that counted,
//                ESPN's own final standings, the auction, player names
//   totals.json  each team's active-lineup stat line for every day, for the
//                race and odds
//   days.json    every rostered player's line each day and every add, drop
//                and trade, for the draft, waiver and trade screens
//
// ESPN responses are kept gzipped in .cache/nba-espn/, so a rebuild (after a
// format change, say) costs no requests.
// Usage: node scripts/nba/build-seasons.mjs [season ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  CURRENT_SEASON,
  CUTOFFS,
  ESPN_LEAGUE,
  FIRST_SEASON,
  OPENERS,
  dayOfDate,
} from '../../worker/nba/config.js';
import {
  DAY_VIEWS,
  LEAGUE_VIEWS,
  compactDay,
  compactLeague,
} from '../../worker/nba/espn.js';
import { buildDraft } from '../../src/nba/lib/moves.ts';
import { addLine, emptyLine, scoreRoto } from '../../src/nba/lib/roto.ts';

const CACHE = '.cache/nba-espn';
const OUT = 'public/nba-data';

async function espn(url, file) {
  const path = `${CACHE}/${file}.json.gz`;
  if (existsSync(path)) return JSON.parse(gunzipSync(readFileSync(path)));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const text = await res.text();
      mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
      writeFileSync(path, gzipSync(text));
      return JSON.parse(text);
    }
    if (attempt === 4) throw new Error(`${res.status} from ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

function withRosterChanges(days) {
  let previous = '';
  const out = [];
  for (const { day, players, rosters, tx } of days) {
    const key = JSON.stringify(rosters);
    const changed = key !== previous && Object.values(rosters).some((r) => r.length);
    previous = key;
    if (!players.length && !tx.length && !changed) continue;
    out.push(changed ? { day, players, rosters, tx } : { day, players, tx });
  }
  return out;
}

async function build(season) {
  const base = ESPN_LEAGUE(season);
  const league = compactLeague(await espn(`${base}?${LEAGUE_VIEWS}`, `${season}/league`));

  // Fetch a few days at a time; ESPN is fine with that, and it's a one-off
  const days = [];
  const ids = Array.from({ length: league.finalDay }, (_, i) => i + 1);
  for (let i = 0; i < ids.length; i += 6) {
    const batch = await Promise.all(
      ids.slice(i, i + 6).map(async (day) =>
        compactDay(
          await espn(`${base}?${DAY_VIEWS}&scoringPeriodId=${day}`, `${season}/day-${day}`),
          day,
        ),
      ),
    );
    days.push(...batch);
    process.stdout.write(`\r${season}: day ${days.length}/${ids.length}`);
  }
  process.stdout.write('\n');

  // Days with games; ESPN's calendar runs on past the last one (2020 stopped
  // for COVID on day 142 but ESPN counts to 258)
  const played = days.filter((d) => d.players.length > 0);
  const cutoffDay = CUTOFFS[season] ? dayOfDate(season, CUTOFFS[season]) : null;
  const counted = played.filter((d) => !cutoffDay || d.day <= cutoffDay);

  const sum = (list) => {
    const totals = new Map(league.teams.map((t) => [t.id, emptyLine()]));
    for (const d of list) for (const [id, line] of Object.entries(d.teams)) addLine(totals.get(Number(id)), line);
    return totals;
  };

  // The daily rebuild must reproduce ESPN's final standings before anything
  // built on it can be trusted
  const rebuilt = sum(played);
  const mismatches = scoreRoto(rebuilt).filter((t) => {
    const espnPoints = league.teams.find((team) => team.id === t.id).espn.points;
    return Math.abs(t.points - espnPoints) > 0.01;
  });
  const statMismatches = league.teams.filter((t) =>
    t.totals.slice(0, 6).some((v, i) => Math.abs(v - rebuilt.get(t.id)[i]) > 0.01),
  );
  if (mismatches.length || statMismatches.length) {
    console.warn(
      `  ${season}: rebuild differs from ESPN for ${mismatches.length} teams' points, ${statMismatches.length} teams' stats`,
    );
  } else {
    console.log(`  ${season}: rebuild matches ESPN's final standings`);
  }

  const names = {};
  for (const d of days) Object.assign(names, d.names);
  // Latest NBA affiliation recorded in this season's ESPN snapshots.
  const proTeams = {};
  for (const d of days) Object.assign(proTeams, d.proTeams);
  const totals = sum(counted);
  const lastDay = counted.at(-1)?.day ?? 0;

  // How each auction pick paid off, saved so pages like a manager's career
  // needn't download every season's daily lines (the Draft screen's own math)
  const finished = {
    ...league,
    lastDay,
    teams: league.teams.map((t) => ({ ...t, totals: totals.get(t.id) })),
  };
  const results = new Map(
    buildDraft(finished, days, names).map((r) => [r.pick, r]),
  );
  league.draft = league.draft.map((pick) => {
    const r = results.get(pick.pick);
    return {
      ...pick,
      points: Math.round(r.points * 10) / 10,
      games: r.games,
      surplus: Math.round(r.surplus * 10) / 10,
    };
  });

  mkdirSync(`${OUT}/${season}`, { recursive: true });
  const write = (file, data) => {
    writeFileSync(`${OUT}/${season}/${file}`, JSON.stringify(data));
    return Math.round(JSON.stringify(data).length / 1024);
  };
  const sizes = [
    write('league.json', {
      ...league,
      opener: OPENERS[season],
      latestDay: league.finalDay,
      lastDay,
      cutoff: CUTOFFS[season] ?? null,
      teams: league.teams.map((t) => ({ ...t, totals: totals.get(t.id) })),
      names,
      proTeams,
    }),
    write('totals.json', {
      days: counted.map((d) => d.day),
      teams: Object.fromEntries(
        league.teams.map((t) => [t.id, counted.map((d) => d.teams[t.id] ?? emptyLine())]),
      ),
    }),
    // Moves happen on days without games too (the All-Star break). Rosters
    // are kept only when they change; the site carries them forward.
    write('days.json', withRosterChanges(days)),
  ];
  console.log(`  wrote league ${sizes[0]} KB, totals ${sizes[1]} KB, days ${sizes[2]} KB; ${counted.length} days count (last day ${lastDay})`);
}

const seasons = process.argv.slice(2).map(Number);
for (const season of seasons.length ? seasons : Array.from({ length: CURRENT_SEASON - FIRST_SEASON }, (_, i) => FIRST_SEASON + i)) {
  await build(season);
}
