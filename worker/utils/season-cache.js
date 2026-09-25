import getDefaults from './get-defaults.js';

// MFL's data for a season before the current one no longer changes, so it can
// be cached far longer. Past a month the edge evicts rarely-read entries anyway.
const FINISHED_SEASON_DATA_SECONDS = 60 * 60 * 24 * 30;

// Our own responses built from data that no longer changes (a finished season
// or week) stay shorter: a deploy doesn't clear the edge cache, so this bounds
// how long an old response shape can linger. Rebuilding one is cheap.
export const FINAL_RESPONSE_SECONDS = 60 * 60 * 24;

export function isFinishedSeason(season) {
  return Number(season) < Number(getDefaults().season);
}

// How long to cache an MFL export for the given season
export function seasonDataSeconds(season, currentSeasonSeconds) {
  return isFinishedSeason(season)
    ? FINISHED_SEASON_DATA_SECONDS
    : currentSeasonSeconds;
}
