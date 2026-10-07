import getData from '../api/get-data.js';
import { getAllPlayers } from '../api/players.js';
import { parseRosterMoves } from '../utils/roster-moves.js';
import getDefaults, { leaguesFor } from '../utils/get-defaults.js';
import { seasonDataSeconds } from '../utils/season-cache.js';
import {
  parseTrades,
  valueTrades,
  weeklyRosterScores,
} from '../utils/trade-value.js';
import { loadWeeks } from './weekly-scores.js';

// How long to cache a response with lineup lift left unrated by MFL
const INCOMPLETE_SECONDS = 60;

const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export default async function tradesYear(c) {
  const season = c.req.param('year') || getDefaults().season;
  if (
    !/^20\d{2}$/.test(season) ||
    Number(season) < 2016 ||
    Number(season) > Number(getDefaults().season)
  ) {
    return c.json({ message: 'Choose a supported season.' }, 400);
  }
  try {
    const leagues = leaguesFor(season);
    const options = { cacheSeconds: seasonDataSeconds(season, 300) };
    const [loaded, players, schedule, leagueData] = await Promise.all([
      loadWeeks(c, season),
      getAllPlayers({ season }),
      getData(`/${season}/export?TYPE=nflSchedule&W=ALL&JSON=1`, options),
      Promise.all(
        leagues.map(async (league) => {
          const [transactions, settings] = await Promise.all([
            getData(
              `/${season}/export?TYPE=transactions&L=${league.id}&JSON=1`,
              options,
            ),
            getData(
              `/${season}/export?TYPE=league&L=${league.id}&JSON=1`,
              options,
            ),
          ]);
          if (
            transactions.error ||
            settings.error ||
            !settings.league?.starters
          )
            throw new Error('Trade data unavailable');
          return {
            league,
            moves: parseRosterMoves(
              transactions.transactions?.transaction,
              league.name,
            ),
            rules: settings.league.starters,
            trades: parseTrades(
              transactions.transactions?.transaction,
              league.name,
            ),
          };
        }),
      ),
    ]);
    if (loaded.response) return loaded.response;
    if (schedule.error || !schedule.fullNflSchedule || !players.size)
      throw new Error('Player or schedule data unavailable');
    const starts = asList(schedule.fullNflSchedule.nflSchedule)
      .map((w) => {
        const games = asList(w.matchup).filter((g) => Number(g.kickoff) > 0);
        const times = games.map((g) => Number(g.kickoff) * 1000);
        return {
          week: Number(w.week),
          time: Math.min(...times),
          end: Math.max(...times),
          kickoffs: Object.fromEntries(
            games.flatMap((g) =>
              asList(g.team).map((team) => [team.id, Number(g.kickoff) * 1000]),
            ),
          ),
        };
      })
      .filter((w) => Number.isFinite(w.time) && w.time > 0)
      .sort((a, b) => a.week - b.week);
    if (!starts.length) throw new Error('NFL schedule unavailable');
    const { weeks } = loaded;
    // Set when MFL refused a week's scores and some lineup lift went unrated
    let incomplete = false;
    const trades = await Promise.all(
      leagueData.map(async ({ league, moves, rules, trades }) => {
        const scores = weeklyRosterScores(weeks, league.name);
        // A sent player may later become a free agent. Fetch those weeks' full
        // scoring only when roster history cannot supply the counterfactual.
        const initial = valueTrades({
          trades,
          departures: moves.departures,
          weeks,
          starts,
          players,
          rules,
          scores,
        });
        const needed = new Set(
          initial
            .filter((t) => !t.unsupported)
            .flatMap((t) =>
              t.sides.flatMap((s) =>
                s.impact
                  .filter((g) => g.withoutTrade === null)
                  .map((g) => g.week),
              ),
            ),
        );
        const missingWeeks = weeks.filter(({ week }) => needed.has(week));
        await Promise.all(
          missingWeeks.map(async ({ week }) => {
            const url = `/${season}/export?TYPE=playerScores&L=${league.id}&W=${week}&JSON=1`;
            try {
              const data = await getData(url, options);
              if (data.error || !data.playerScores) {
                incomplete = true;
                console.warn(`No player scores from ${url}`, data.error);
                return;
              }
              const full = new Map(
                asList(data.playerScores.playerScore).map((p) => [
                  p.id,
                  Number(p.score) || 0,
                ]),
              );
              // A successful scores export omits players with no points.
              trades.forEach((t) =>
                t.sides.forEach((s) =>
                  s.sent.forEach((id) => {
                    if (players.has(id) && !scores.get(week).has(id))
                      scores.get(week).set(id, full.get(id) ?? 0);
                  }),
                ),
              );
            } catch (error) {
              // Keep the trade and its production, but leave lineup lift unrated.
              incomplete = true;
              console.warn(`No player scores from ${url}: ${error.message}`);
            }
          }),
        );
        return valueTrades({
          trades,
          departures: moves.departures,
          weeks,
          starts,
          players,
          rules,
          scores,
        });
      }),
    );
    // Don't hold a gap left by a refused request for a finished season's day
    if (incomplete) c.header('Cache-Control', `max-age=${INCOMPLETE_SECONDS}`);
    return c.json({
      lastWeek: weeks.at(-1)?.week ?? 0,
      trades: trades.flat().sort((a, b) => b.time - a.time),
    });
  } catch (error) {
    console.error(`Unable to load ${season} trades`, error);
    return c.json(
      { message: `Unable to load trades for the ${season} season.` },
      503,
    );
  }
}
