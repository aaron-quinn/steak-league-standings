import getWeeklyResults from '../api/weekly-results.js';
import getDefaults, { leaguesFor } from '../utils/get-defaults.js';

// Both leagues' played weeks merged by week number, or a 503 response
export async function loadWeeks(c, season) {
  const leagues = leaguesFor(season);
  const byWeek = new Map();

  // Ask MFL for both leagues at once rather than one after the other
  const results = await Promise.all(
    leagues.map((league) =>
      getWeeklyResults({ season, leagueID: league.id, prefix: league.name }),
    ),
  );

  for (const [i, league] of leagues.entries()) {
    const { weeks, error } = results[i];

    if (error || !weeks) {
      console.error(
        `Unable to load ${season} weekly results for ${league.name}`,
        error,
      );
      return {
        response: c.json(
          {
            statusCode: 503,
            error: 'Service Unavailable',
            message: `Unable to load weekly results for the ${season} season.`,
          },
          503,
        ),
      };
    }

    weeks.forEach(({ week, teams }) => {
      byWeek.set(week, { ...byWeek.get(week), ...teams });
    });
  }

  return {
    weeks: [...byWeek.entries()]
      .sort(([a], [b]) => a - b)
      .map(([week, teams]) => ({ week, teams })),
  };
}

// Each played week's score for every team, for charting the season
export default async function weeklyScoresYear(c) {
  const { season: defaultSeason } = getDefaults();
  const season = c.req.param('year') || defaultSeason;

  const { weeks, response } = await loadWeeks(c, season);
  if (response) return response;

  return c.json(
    weeks.map(({ week, teams }) => ({
      week,
      scores: Object.fromEntries(
        Object.entries(teams).map(([id, team]) => [
          id,
          Math.round(team.score * 100) / 100,
        ]),
      ),
    })),
  );
}
