import getLiveMatchups from '../api/live-matchups.js';
import getDefaults from '../utils/get-defaults.js';

export default async function getLiveMatchupsYear(c) {
  const { season: defaultSeason, leagues } = getDefaults();
  const season = c.req.param('year') || defaultSeason;

  const matchupList = [];
  let unavailable = null;

  for (const league of leagues) {
    const {
      matchups: liveMatchups,
      error,
      unavailable: leagueUnavailable,
    } = await getLiveMatchups({
      season,
      leagueID: league.id,
      prefix: `${league.name}`,
    });

    // An unexpected failure is a real error, not an empty week
    if (error) {
      console.error(
        `Unable to load ${season} matchups for ${league.name}`,
        error,
      );
      return c.json(
        {
          statusCode: 503,
          error: 'Service Unavailable',
          message: `Unable to load matchups for the ${season} season.`,
        },
        503,
      );
    }

    if (leagueUnavailable) {
      unavailable = leagueUnavailable;
    }

    (liveMatchups || []).forEach((matchup) => {
      matchupList.push(matchup);
    });
  }

  // Before the season starts MFL has no live scoring, so there are no
  // matchups to report yet. That is an empty result, not a failure.
  if (unavailable && matchupList.length === 0) {
    c.header('x-matchups-unavailable', unavailable);
  }

  return c.json(matchupList);
}
