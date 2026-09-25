export default function getDefaults() {
  return {
    season: '2026',
    // Each league lives on one MFL server (the same one every season since
    // 2021). Asking it directly skips a redirect from api.myfantasyleague.com;
    // if MFL ever moves a league, the old server redirects to the new one.
    leagues: [
      { id: '68362', name: 'madison', host: 'www45.myfantasyleague.com' },
      { id: '73077', name: 'la', host: 'www44.myfantasyleague.com' },
    ],
  };
}
