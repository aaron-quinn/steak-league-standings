# RotoWire availability refresh

The Worker's `scheduled` handler refreshes NBA rest-of-season games every six
hours (`0 */6 * * *`, UTC). RotoWire credentials are Cloudflare secrets named
`ROTOWIRE_USERNAME` and `ROTOWIRE_PASSWORD`. They must never be placed in source,
public assets, KV, or logs. Update them with `wrangler secret put` if needed.

The refresh signs in using RotoWire's normal CSRF/session flow, checks the season
shown on the rest-of-season page, and downloads the subscriber projections. It
requires at least 300 valid players and 300 ESPN ID matches. Invalid, incomplete,
or unauthenticated responses never replace the last successful snapshot.

RotoWire's games are remaining-season totals. We add ESPN games already played
at download time to store a season budget; the roster model subtracts current
games played and caps the result at the NBA team's remaining schedule. Per-game
stat projections remain the site's historical blend. ESPN supplies injury tags.

The existing `NBA` KV namespace holds `rotowire:<season>` and
`rotowire:<season>:status`. `/api/nba/rotowire/<season>` returns freshness,
last successful check, last attempt, and matched games. It returns no RotoWire
games after 48 hours without a successful refresh; the page falls back to ESPN,
then history. The page polls once per minute and shows the current source status.
"Checked" means the download succeeded, not that RotoWire revised its forecasts.

For failures, inspect Worker logs for `RotoWire refresh failed` and the API's
`refreshFailed` and `lastAttemptAt` fields. Account details and response bodies
are deliberately excluded from logs. An expired subscription or changed login
flow may require fixing the refresh; normal scheduled attempts continue meanwhile.

Validation: `npm test` covers conversion, zero games, coverage/season rejection,
session/CSRF propagation, retention on failure, and the 48-hour cutoff.
`npm run build` checks TypeScript and creates the deployable Worker and site.
