// The NBA Steak League: an ESPN roto league (8 categories, weekly lineups).
// ESPN names a season by the year it ends: 2027 is the 2026–27 season.
export const LEAGUE_ID = 50106954;
// 2018 (2017-18) was played on Yahoo, before the ESPN league, and only its
// final standings survive: standings-only, built by scripts/nba/build-yahoo.mjs.
export const FIRST_SEASON = 2018;
// The season in progress. Earlier seasons are served from public/nba-data/, built
// once by scripts/nba/build-seasons.mjs.
export const CURRENT_SEASON = 2027;

export const ESPN_LEAGUE = (season) =>
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;

// ESPN scores each day as one scoring period, numbered from the NBA's opening
// night: day N is the opener plus N - 1 days
export const OPENERS = {
  2018: '2017-10-17',
  2019: '2018-10-16',
  2020: '2019-10-22',
  2021: '2020-12-22',
  2022: '2021-10-19',
  2023: '2022-10-18',
  2024: '2023-10-24',
  2025: '2024-10-22',
  2026: '2025-10-21',
  2027: '2026-10-20',
};

export function dateOfDay(season, day) {
  const date = new Date(`${OPENERS[season]}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

export function dayOfDate(season, isoDate) {
  const ms =
    Date.parse(`${isoDate}T12:00:00Z`) -
    Date.parse(`${OPENERS[season]}T12:00:00Z`);
  return Math.round(ms / 864e5) + 1;
}

// The league ended these seasons early because of NBA tanking: only games
// through this date counted, whatever ESPN's own final standings say.
export const CUTOFFS = { 2024: '2024-03-31', 2025: '2025-03-31' };

// ESPN stat IDs kept for each player and team, in this order everywhere:
// PTS, REB, AST, 3PM, STL, BLK, FGM, FGA, FTM, FTA
export const STAT_IDS = ['0', '6', '3', '17', '2', '1', '13', '14', '15', '16'];
// Games played, kept alongside the stats for each player line
export const GP = '42';
// Minutes, summed per team for the active lineup
export const MIN = '40';

// Lineup slots that don't count
export const BENCH = 12;
export const IR = 13;

// ESPN account name → the name the NFL site uses for the same person
const RENAME = {
  'Timothy Schuler': 'Tim Schuler',
  'Harold Thompson': 'Harry Thompson',
  'eric neuman': 'Eric Neuman',
  "kevin o'brien": "Kevin O'Brien",
};

// The person behind a team, from ESPN's members list ('' if nobody owns it)
export function ownerName(team, members) {
  const names = new Set(
    (team.owners ?? [])
      .map((id) => members.find((member) => member.id === id))
      .filter(Boolean)
      .map(({ firstName, lastName }) => {
        const name = `${firstName} ${lastName}`.trim();
        return RENAME[name] ?? name;
      }),
  );
  return [...names].join(' & ');
}
