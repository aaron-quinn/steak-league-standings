export default function getDefaults() {
  return {
    season: '2026',
    // Each league lives on one MFL server (the same one every season since
    // 2021). Asking it directly skips a redirect from api.myfantasyleague.com;
    // if MFL ever moves a league, the old server redirects to the new one.
    leagues: [
      { id: '68362', name: 'madison', host: 'www45.myfantasyleague.com' },
      {
        id: '73077',
        name: 'la',
        host: 'www44.myfantasyleague.com',
        // LA was a new MFL league each season before settling on 73077
        pastIDs: { 2016: '33496' },
      },
    ],
  };
}

// The leagues with the MFL league ID each one used in the given season
export function leaguesFor(season) {
  return getDefaults().leagues.map((league) => ({
    ...league,
    id: league.pastIDs?.[season] ?? league.id,
  }));
}
