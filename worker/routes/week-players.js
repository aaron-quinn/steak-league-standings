import { getPlayersByID } from '../api/players.js';
import getDefaults from '../utils/get-defaults.js';
import {
  FINAL_RESPONSE_SECONDS,
  isFinishedSeason,
} from '../utils/season-cache.js';
import { loadWeeks } from './weekly-scores.js';

// Every rostered player's score for one played week, highest first. A player
// rostered in both leagues is listed once with each team that has him.
export default async function weekPlayersYear(c) {
  const { season: defaultSeason } = getDefaults();
  const season = c.req.param('year') || defaultSeason;
  const week = Number(c.req.param('week'));

  const { weeks, response } = await loadWeeks(c, season);
  if (response) return response;

  const result = weeks.find((w) => w.week === week);
  if (!result) {
    return c.json(
      {
        statusCode: 404,
        error: 'Not Found',
        message: `Week ${week} of the ${season} season has not been played.`,
      },
      404,
    );
  }

  const byID = new Map();
  Object.entries(result.teams).forEach(([franchiseID, team]) => {
    team.players.forEach(({ id, score, starter }) => {
      const player = byID.get(id) ?? { id, score, owners: [] };
      player.owners.push({ franchiseID, starter });
      byID.set(id, player);
    });
  });

  const details = await getPlayersByID({ season, ids: new Set(byID.keys()) });

  const players = [...byID.values()]
    .map((player) => {
      const detail = details.get(player.id);
      return {
        ...player,
        name: detail?.name ?? player.id,
        position: detail?.position ?? '',
        team: detail?.team ?? '',
      };
    })
    .sort((a, b) => b.score - a.score);

  // MFL's stat corrections land on the latest played week, so refresh it as
  // often as the standings. An earlier week no longer changes.
  const latest =
    !isFinishedSeason(season) && week === weeks[weeks.length - 1].week;
  c.header(
    'Cache-Control',
    `max-age=${latest ? 60 : FINAL_RESPONSE_SECONDS}`,
  );

  return c.json({ week, players });
}
