// The league's first season was played on Yahoo, not ESPN, and only the final
// standings survive there: no daily rosters, no auction, and no per-player
// stats, so nothing can be scored for a race, the odds or the moves screens.
// This writes a standings-only season into public/nba-data/2018/:
//
//   league.json  each team's season totals and Yahoo's own final roto points
//   days.json    empty, so the screens that need daily lineups show nothing
//   totals.json  empty, for the same reason
//
// Totals come from Yahoo's Overall Stats table, in the same 10-number StatLine
// the ESPN seasons use. Yahoo prints percentages rounded to three decimals, so
// teams that tie at that precision get the exact value from the tiebreaker
// tables beside the standings. The build then runs the site's own scorer and
// checks it reproduces Yahoo's published points, stopping if it doesn't.
//
// Yahoo labels a season by the year it starts, so Yahoo's 2017 is the season
// ESPN (and this site) name 2018: the league's first year, 2017-18.
//
// Usage: node scripts/nba/build-yahoo.mjs [saved-standings.html]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { scoreRoto } from '../../src/nba/lib/roto.ts';

const SEASON = 2018;
const OPENER = '2017-10-17'; // NBA opening night
const FINAL_DAY = 177; // through April 11, 2018, the last day of the regular season
const PAGE = 'https://basketball.fantasysports.yahoo.com/2017/nba/135086/standings';
const CACHE = '.cache/nba-yahoo/standings.html';
const OUT = `public/nba-data/${SEASON}`;

// Who ran each team: nine read off the 2019 (2018-19) managers, the first ESPN
// season, plus the three 2017-18 names that match no 2018-19 manager
// (confirmed by the league, not inferable from Yahoo: it hides manager names in
// the archived season).
const OWNERS = {
  'Fighting Ballmers': 'D.J. Trainor', // the 2017-18 winner
  Quinners: 'Aaron Quinn',
  "shannon m's Team": 'Shannon McKeown',
  "The KAT's Meow": 'Eric Neuman',
  'Team Whalen': 'Nick Whalen',
  "kevin's Team": "Kevin O'Brien",
  Shanksanity: 'Peter Schoenke',
  "James's Tip-Top Team": 'James Anderson',
  'Big Barutha Brand': 'Alex Barutha',
  "Adam's Team": 'Adam Wolf',
  "Ben's Bold Team": 'Ben Miller',
  "sweet deal's Team": 'Eric Caturia',
};

const unescape = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
const text = (cell) => unescape(cell.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Rows of the first table after an anchor, as arrays of cell text
function tableAfter(html, anchor) {
  const at = html.indexOf(anchor);
  if (at < 0) throw new Error(`no "${anchor}" table on the page`);
  const open = html.indexOf('<table', at);
  const close = html.indexOf('</table>', open);
  const rows = [];
  for (const tr of html.slice(open, close).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => text(m[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

// Yahoo splits a league-wide tie at the printed precision across pages of
// tiebreaker tables; each holds a heading and name/percentage pairs
function tiebreakers(html) {
  const out = { fgp: {}, ftp: {} };
  for (const m of html.matchAll(
    /<h2[^>]*>(Field Goal|Free Throw) Percentage Tiebreaker<\/h2>([\s\S]*?)<\/table>/gi,
  )) {
    const into = m[1] === 'Field Goal' ? out.fgp : out.ftp;
    for (const row of m[2].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => text(c[1]));
      if (cells.length === 2 && !into[cells[0]]) into[cells[0]] = Number(cells[1]);
    }
  }
  return out;
}

const number = (s) => Number(s.replace(/,/g, '').replace('*', '').trim());

// Percentages are ratios of made to attempted shots. Yahoo only publishes the
// ratio, so each is stored against a large, fixed denominator: enough digits to
// keep every team's true order, and the display rounds back to Yahoo's three.
const DEN = 1e7;
const ratio = (pct) => [Math.round(pct * DEN), DEN];

async function source() {
  const file = process.argv[2];
  if (file) return readFileSync(file, 'utf8');
  if (existsSync(CACHE)) return readFileSync(CACHE, 'utf8');
  console.log(`fetching ${PAGE}`);
  const res = await fetch(PAGE, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${res.status} from ${PAGE}`);
  const html = await res.text();
  mkdirSync('.cache/nba-yahoo', { recursive: true });
  writeFileSync(CACHE, html);
  return html;
}

const html = await source();
const points = tableAfter(html, 'Overall Points').slice(2); // skip two header rows
const stats = tableAfter(html, 'Overall Stats').slice(2);
const tied = tiebreakers(html);
if (points.length !== stats.length || points.length < 2)
  throw new Error('could not read the standings tables');

const teams = stats.map((row, i) => {
  const name = row[1];
  // [rank, team, GP, FG%, FT%, 3PTM, PTS, REB, AST, STL, BLK]
  const fgp = tied.fgp[name] ?? number(row[3]);
  const ftp = tied.ftp[name] ?? number(row[4]);
  const yahoo = {
    season: Number(points[i][0].replace('.', '')),
    points: Number(points[i][10]),
    // FG%, FT%, 3PTM, PTS, REB, AST, STL, BLK
    categories: points[i].slice(2, 10).map(Number),
  };
  return {
    id: i + 1,
    name,
    owner: OWNERS[name] ?? '',
    totals: [
      number(row[6]), // PTS
      number(row[7]), // REB
      number(row[8]), // AST
      number(row[5]), // 3PM
      number(row[9]), // STL
      number(row[10]), // BLK
      ...ratio(fgp),
      ...ratio(ftp),
    ],
    yahoo,
  };
});

// The site's scorer has to agree with Yahoo's own points, or the season is not
// worth shipping
const totals = new Map(teams.map((t) => [t.id, t.totals]));
const scored = scoreRoto(totals).sort((a, b) => b.points - a.points);
for (const row of scored) {
  const team = teams[row.id - 1];
  if (Math.abs(row.points - team.yahoo.points) > 1e-9)
    throw new Error(
      `${team.name}: the site scores ${row.points}, Yahoo ${team.yahoo.points}`,
    );
}

const rank = new Map(scored.map((row, i) => [row.id, i + 1]));
const league = {
  season: SEASON,
  opener: OPENER,
  finalDay: FINAL_DAY,
  latestDay: FINAL_DAY,
  lastDay: FINAL_DAY,
  cutoff: null,
  budget: 100,
  teams: teams.map((t) => ({
    id: t.id,
    name: t.name,
    abbrev: (t.owner || t.name).split(' ').pop().slice(0, 4).toUpperCase(),
    owner: t.owner,
    totals: t.totals,
    espn: { points: t.yahoo.points, rank: rank.get(t.id) },
  })),
  draft: [],
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/league.json`, JSON.stringify(league, null, 1) + '\n');
writeFileSync(`${OUT}/days.json`, '[]\n');
writeFileSync(`${OUT}/totals.json`, JSON.stringify({ days: [], teams: {} }) + '\n');

console.log(`wrote ${OUT}/ with ${teams.length} teams; the site's scorer matches Yahoo's points`);
for (const row of scored) {
  const team = teams[row.id - 1];
  console.log(`  ${String(rank.get(row.id)).padStart(2)}. ${team.name.padEnd(22)} ${team.owner.padEnd(17)} ${row.points}`);
}
