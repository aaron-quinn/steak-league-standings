import { getAllPlayers } from '../api/players.js';
import getPlayerScores from '../api/player-scores.js';
import getDefaults from '../utils/get-defaults.js';
import valueDraft from '../utils/draft-value.js';
import { loadWeeks } from './weekly-scores.js';
import draft2026 from '../data/draft/2026.json';

// Each season's auction, by league name: which franchise bought each MFL
// player and for how much. The auctions run outside MFL, so the results are
// kept here rather than fetched.
const drafts = { 2026: draft2026 };

// Every auction pick with what his season has been worth through the last
// finished week
export default async function draftYear(c) {
  const { season: defaultSeason, leagues } = getDefaults();
  const season = c.req.param('year') || defaultSeason;

  const draft = drafts[season];
  if (!draft) {
    return c.json(
      {
        statusCode: 404,
        error: 'Not Found',
        message: `No draft results for the ${season} season.`,
      },
      404,
    );
  }

  // Shared with the standings, so usually already cached
  const { weeks, response } = await loadWeeks(c, season);
  if (response) return response;
  const week = weeks[weeks.length - 1]?.week ?? 0;

  let players;
  let seasons;
  let inProgress;
  try {
    // Ask MFL for everything at once rather than one after the other
    const scores = (w) =>
      Promise.all(
        leagues.map((league) =>
          getPlayerScores({ season, leagueID: league.id, week: w }),
        ),
      );
    [players, seasons, inProgress] = await Promise.all([
      getAllPlayers({ season }),
      scores('YTD'),
      scores(week + 1),
    ]);
  } catch (error) {
    console.error(`Unable to load ${season} draft values`, error);
    return c.json(
      {
        statusCode: 503,
        error: 'Service Unavailable',
        message: `Unable to load draft values for the ${season} season.`,
      },
      503,
    );
  }

  return c.json({
    week,
    leagues: leagues.map((league, i) => {
      // Midweek, players whose game is done would be a game ahead of the
      // rest, so leave the week in progress out
      const scores = new Map(
        [...seasons[i]].map(([id, points]) => [
          id,
          points - (inProgress[i].get(id) ?? 0),
        ]),
      );
      const { picks, ...valuation } = valueDraft({
        picks: draft[league.name] ?? [],
        scores,
        positionOf: (id) => players.get(id)?.position,
      });

      return {
        league: league.name,
        ...valuation,
        picks: picks.map((pick) => {
          const player = players.get(pick.player);
          return {
            franchiseID: `${league.name}${pick.franchise}`,
            id: pick.player,
            // MFL names team kickers after the team, but the auction was
            // for the kicker
            name:
              player && player.position !== 'TMPK' ? player.name : pick.name,
            position: player?.position ?? '',
            team: player?.team ?? '',
            price: pick.price,
            points: pick.points,
            worth: pick.worth,
          };
        }),
      };
    }),
  });
}
