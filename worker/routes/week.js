import getLiveScores from '../api/live-scores.js';
import getStandings from '../api/standings.js';
import getDefaults from '../utils/get-defaults.js';

export default async function getWeek(request, reply) {
  const { season: defaultSeason, leagues } = getDefaults();
  const season = request.params.year || defaultSeason;
  // Just use the first league to get the week
  const league = leagues[0];

  const unavailable = (error) => {
    request.log.error(error, `Unable to determine the week for ${season}`);
    reply.code(503).send({
      statusCode: 503,
      error: 'Service Unavailable',
      message: `Unable to determine the current week for the ${season} season.`,
    });
  };

  // Get standings to calculate week based on games played
  const { standings, error: standingsError } = await getStandings({
    season,
    leagueID: league.id,
    prefix: league.name,
  });

  // A failed request must not look like a season that has not started yet,
  // or a rate limited call would report week 1 mid-season.
  if (standingsError || !standings) {
    unavailable(standingsError);
    return;
  }

  // Calculate week as the max games played (wins + losses + ties) across all teams
  let maxGamesPlayed = 0;
  Object.values(standings).forEach((team) => {
    const gamesPlayed =
      (team.wins || 0) + (team.losses || 0) + (team.ties || 0);
    if (gamesPlayed > maxGamesPlayed) {
      maxGamesPlayed = gamesPlayed;
    }
  });

  // If we have games played data, use that as the week
  if (maxGamesPlayed > 0) {
    reply.send({ week: maxGamesPlayed + 1 }); // Next week is current week
    return;
  }

  // Otherwise fall back to MFL's week
  const {
    week: liveWeek,
    error: liveError,
    unavailable: liveUnavailable,
  } = await getLiveScores({
    season,
    leagueID: league.id,
    prefix: `${league.name}`,
  });

  if (liveError) {
    unavailable(liveError);
    return;
  }

  // No results and no live scoring means the season has not started yet,
  // so the upcoming week is week 1.
  reply.send({ week: liveUnavailable ? 1 : Number(liveWeek) || 1 });
}
