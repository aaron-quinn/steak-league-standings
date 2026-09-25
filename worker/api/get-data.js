import fetchJSON from './fetch-json.js';
import getDefaults from '../utils/get-defaults.js';

// MFL wants requests that aren't about one league sent here, which spreads
// them across its servers
const baseURL = 'https://api.myfantasyleague.com';

export default async function getData(url, options) {
  const leagueID = new URLSearchParams(url.split('?')[1]).get('L');
  const league = getDefaults().leagues.find((l) => l.id === leagueID);
  const origin = league ? `https://${league.host}` : baseURL;
  return fetchJSON(`${origin}${url}`, options);
}
