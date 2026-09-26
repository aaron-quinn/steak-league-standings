// Finished seasons' MFL exports are saved in public/mfl (by
// scripts/archive-mfl.mjs) and served as static assets, so past seasons never
// wait on MFL or count against its rate limit. This names each export's file.

// Asking for particular players is answered from the season's full list
const PLAYERS_PARAM = 'PLAYERS';

// "/2019/export?TYPE=weeklyResults&L=68362&W=YTD&JSON=1" becomes
// "/mfl/2019/weeklyResults.L-68362.W-YTD.json". Null for anything else.
export function archivePath(url) {
  const [path, query = ''] = url.split('?');
  const season = path.match(/^\/(\d{4})\/export$/)?.[1];
  if (!season) return null;

  const params = new URLSearchParams(query);
  const type = params.get('TYPE');
  if (!type) return null;
  const rest = [...params.entries()]
    .filter(([key]) => !['TYPE', 'JSON', PLAYERS_PARAM].includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `.${key}-${value}`)
    .join('');
  return `/mfl/${season}/${type}${rest}.json`;
}

// The player IDs a players request asks for, if it names any
export function requestedPlayers(url) {
  const ids = new URLSearchParams(url.split('?')[1]).get(PLAYERS_PARAM);
  return ids ? new Set(ids.split(',')) : null;
}

// Every export the site reads for a finished season
export function seasonExports(season, leagueIDs) {
  return [
    `/${season}/export?TYPE=players&JSON=1`,
    `/${season}/export?TYPE=nflSchedule&W=ALL&JSON=1`,
    ...leagueIDs.flatMap((id) => [
      `/${season}/export?TYPE=league&L=${id}&JSON=1`,
      `/${season}/export?TYPE=weeklyResults&L=${id}&W=YTD&JSON=1`,
      `/${season}/export?TYPE=transactions&L=${id}&JSON=1`,
      `/${season}/export?TYPE=liveScoring&L=${id}&JSON=1`,
      `/${season}/export?TYPE=liveScoring&L=${id}&DETAILS=1&JSON=1`,
    ]),
  ];
}
