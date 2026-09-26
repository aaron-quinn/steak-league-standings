import { getPlayersByID } from '../api/players.js';
import {
  getRosterMoves,
  getWaiverBudget,
  getWeekDeadlines,
} from '../api/waivers.js';
import getDefaults from '../utils/get-defaults.js';
import { loadWeeks } from './weekly-scores.js';

// Keeps each players export request well inside MFL's URL length limit
const PLAYERS_PER_REQUEST = 250;

const round = (value) => Math.round(value * 100) / 100;

// Every pickup of the season in both leagues, with what it cost and what the
// player scored for the team that added him
export default async function waiversYear(c) {
  const { season: defaultSeason, leagues } = getDefaults();
  const season = c.req.param('year') || defaultSeason;

  const unavailable = (error) => {
    console.error(`Unable to load ${season} waiver pickups`, error);
    return c.json(
      {
        statusCode: 503,
        error: 'Service Unavailable',
        message: `Unable to load waiver pickups for the ${season} season.`,
      },
      503,
    );
  };

  let loaded;
  try {
    // Ask MFL for everything at once rather than one after the other
    loaded = await Promise.all([
      loadWeeks(c, season),
      getWeekDeadlines(season),
      Promise.all(
        leagues.map((league) =>
          getRosterMoves({ season, leagueID: league.id, prefix: league.name }),
        ),
      ),
      Promise.all(
        leagues.map((league) =>
          getWaiverBudget({ season, leagueID: league.id }),
        ),
      ),
    ]);
  } catch (error) {
    return unavailable(error);
  }
  const [{ weeks, response }, deadlines, moves, budgets] = loaded;
  if (response) return response;

  // The first week a move at this time can affect, or Infinity once the
  // season is over
  const weekOf = (time) =>
    deadlines.find(({ deadline }) => deadline > time)?.week ?? Infinity;

  // Each team's weeks with a player on its roster, by "team:player"
  const rostered = new Map();
  weeks.forEach(({ week, teams }) =>
    Object.entries(teams).forEach(([franchiseID, team]) =>
      team.players.forEach(({ id, score, starter }) => {
        const key = `${franchiseID}:${id}`;
        if (!rostered.has(key)) rostered.set(key, []);
        rostered.get(key).push({ week, score, starter });
      }),
    ),
  );

  const pickups = moves.flatMap(({ pickups: leaguePickups, departures }) =>
    leaguePickups.map((pickup) => {
      const { franchiseID, playerID, time } = pickup;
      const sameMove = (move) =>
        move.franchiseID === franchiseID && move.playerID === playerID;
      const from = weekOf(time);

      // He counts for this team until it drops or trades him, or until it
      // picks him up again, which starts a new stint. A player on the taxi
      // squad is missing from the weekly rosters, so those weeks score nothing.
      const left = departures.find((d) => sameMove(d) && d.time > time);
      const again = leaguePickups.find((p) => sameMove(p) && p.time > time);
      const through = Math.min(
        left ? weekOf(left.time) : Infinity,
        again ? weekOf(again.time) - 1 : Infinity,
      );
      const games = (rostered.get(`${franchiseID}:${playerID}`) ?? []).filter(
        ({ week }) => week >= from && week <= through,
      );

      // The last team in the league to cut him loose, if one did
      const droppedBy = departures.findLast(
        (d) =>
          d.drop &&
          d.playerID === playerID &&
          d.franchiseID !== franchiseID &&
          d.time < time,
      )?.franchiseID;

      return {
        ...pickup,
        week: Number.isFinite(from) ? from : null,
        droppedBy: droppedBy ?? null,
        points: round(games.reduce((sum, g) => sum + g.score, 0)),
        started: round(
          games.reduce((sum, g) => sum + (g.starter ? g.score : 0), 0),
        ),
        games: games.map((g) => ({ ...g, score: round(g.score) })),
      };
    }),
  );

  const ids = [
    ...new Set(pickups.flatMap((p) => [p.playerID, ...p.dropped])),
  ].sort();
  const chunks = [];
  for (let i = 0; i < ids.length; i += PLAYERS_PER_REQUEST) {
    chunks.push(new Set(ids.slice(i, i + PLAYERS_PER_REQUEST)));
  }
  const details = new Map(
    (
      await Promise.all(
        chunks.map((chunk) => getPlayersByID({ season, ids: chunk })),
      )
    ).flatMap((map) => [...map]),
  );
  const player = (id) => {
    const detail = details.get(id);
    return {
      id,
      name: detail?.name ?? id,
      position: detail?.position ?? '',
      team: detail?.team ?? '',
    };
  };

  return c.json({
    lastWeek: weeks[weeks.length - 1]?.week ?? 0,
    budgets: Object.fromEntries(
      leagues.map((league, i) => [league.name, budgets[i]]),
    ),
    pickups: pickups.map(({ playerID, dropped, ...pickup }) => ({
      ...pickup,
      player: player(playerID),
      dropped: dropped.map(player),
    })),
  });
}
