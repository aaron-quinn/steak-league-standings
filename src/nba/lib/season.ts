// Season facts the pages need. Keep in step with worker/nba/config.js. 2018
// (2017-18) was played on Yahoo and is standings-only: see build-yahoo.mjs.
export const FIRST_SEASON = 2018;
export const CURRENT_SEASON = 2027;

export const SEASONS = Array.from(
  { length: CURRENT_SEASON - FIRST_SEASON + 1 },
  (_, i) => CURRENT_SEASON - i,
);

// Opening night of CURRENT_SEASON (worker/nba/config.js OPENERS)
export const CURRENT_OPENER = '2026-10-20';

export const isFinished = (season: number) => season < CURRENT_SEASON;

// Pages open on the last finished season until the new one tips off
export const DEFAULT_SEASON =
  Date.now() >= new Date(`${CURRENT_OPENER}T00:00:00-04:00`).getTime()
    ? CURRENT_SEASON
    : CURRENT_SEASON - 1;

// ESPN names a season by the year it ends: 2027 → "2026–27"
export const seasonLabel = (season: number) =>
  `${season - 1}–${String(season).slice(2)}`;

// Day N of a season is opening night plus N - 1 days
export function dateOfDay(opener: string, day: number) {
  const date = new Date(`${opener}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date;
}

export const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
