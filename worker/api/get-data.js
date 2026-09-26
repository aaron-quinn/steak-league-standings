import { env } from 'cloudflare:workers';
import fetchJSON from './fetch-json.js';
import getDefaults from '../utils/get-defaults.js';
import { archivePath, requestedPlayers } from '../utils/mfl-archive.js';
import { isFinishedSeason } from '../utils/season-cache.js';

// MFL wants requests that aren't about one league sent here, which spreads
// them across its servers
const baseURL = 'https://api.myfantasyleague.com';

export default async function getData(url, options) {
  const archived = await fromArchive(url);
  if (archived) return archived;

  const leagueID = new URLSearchParams(url.split('?')[1]).get('L');
  const league = getDefaults().leagues.find((l) => l.id === leagueID);
  const origin = league ? `https://${league.host}` : baseURL;
  return fetchJSON(`${origin}${url}`, options);
}

// Parsed saved exports, kept for as long as the Worker instance lives since
// they never change. Callers share each object, so they must not modify it.
const archive = new Map();

// A finished season's saved copy of the export, or null to ask MFL
async function fromArchive(url) {
  const season = url.match(/^\/(\d{4})\//)?.[1];
  const path = archivePath(url);
  if (!season || !path || !isFinishedSeason(season)) return null;

  if (!archive.has(path)) archive.set(path, loadArchived(path));
  const data = await archive.get(path);
  if (!data) return null;
  const ids = requestedPlayers(url);
  if (!ids) return data;
  const players = [data.players?.player ?? []].flat();
  return {
    ...data,
    players: { player: players.filter((player) => ids.has(player.id)) },
  };
}

async function loadArchived(path) {
  // Only the path matters. The dev server refuses hosts other than localhost.
  const response = await env.ASSETS.fetch(`http://localhost${path}`);  // A missing file comes back as the site's index.html
  if (
    !response.ok ||
    !response.headers.get('Content-Type')?.includes('application/json')
  ) {
    return null;
  }
  return response.json();
}
