# Steak League Standings

A mini-site that displays the standings and history for the RotoWire NFL Steak League.

[SteakStandings.com](https://www.steakstandings.com/)

## Tech Stack

Built with modern web technologies:

- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest)
- **Routing**: [React Router](https://reactrouter.com/)
- **API**: [Hono](https://hono.dev/) on [Cloudflare Workers](https://developers.cloudflare.com/workers/), in `worker/`

The site and its API deploy together as a single Cloudflare Worker. Requests to
`/api/*` run the Worker, which pulls data from MyFantasyLeague and ESPN; every
other path is served from the built site.

## Getting Started

### Prerequisites

- Node.js (v20.5.0 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Running Locally

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in your terminal). The API runs inside the same dev server, at `/api`.

### Building for Production

To create a production build:

```bash
npm run build
```

The site is written to `dist/client` and the Worker to `dist/steak`.

### Preview Production Build

To locally preview the production build in the Workers runtime:

```bash
npm run preview
```

### Deploying

```bash
npx wrangler login # first time only
npm run deploy
```

### Archiving a Finished Season

Past seasons' MyFantasyLeague exports are saved in `public/mfl/<year>/` and
served with the site. The Worker reads those instead of asking MFL, and only
goes to MFL for the current season or a file that isn't there. Once a season
ends and the default season in `worker/utils/get-defaults.js` moves on, save it:

```bash
node scripts/archive-mfl.mjs 2026
```

Run it with no year to fill in any missing season, or add `--force` to
download files again.

### Trade Valuation

The Fun → Trades screen (`/fun/trades`) covers accepted MFL trades from 2016
through the current season, with season and league filters. Three measures can
be selected, and the selected measure controls both trade winners and team
rankings. The default season is 2026 and the default sort is Most lopsided.
Choose All time to combine all available seasons, with each trade still valued
only within its own season. All-time team totals follow managers across league
and franchise changes; a reused franchise slot does not merge different owners.
Unknown owners stay separate by season. Missing seasons are identified and can
be retried without discarding the successfully loaded history.

Available valuation measures:

- **Lineup lift (default):** for each team's observed weekly roster, find the
  highest-scoring lineup allowed by its league's actual position and flex
  limits. Compare it with the same roster after removing the still-held
  acquisitions and restoring the players sent away. Each team's difference is
  independent, so a positional-needs trade can benefit both teams.
- **Started points:** actual starting-lineup points earned by acquired players
  during their stint on their new team.
- **Roster points:** all acquired-player points during that stint, including
  bench production.

The evaluation uses each player’s NFL kickoff, so a Friday trade can count
Sunday’s games in that same week. Games that locked before the trade are
excluded from acquired production and cannot become new lineup options for
either side of the trade.
A stint ends at the first subsequent drop or trade; games kicked off before that
departure still count, and reacquisitions do not reopen the stint. Taxi-only
acquisitions have zero realized value. Future draft picks and unknown player IDs
are preserved, but leave a deal unrated. Missing counterfactual scores leave lineup
lift unrated while retaining the production data. The API first uses archived
weekly roster scores, fetching full weekly scoring only when a sent player's
score is missing from those rosters.

Lineup lift measures hindsight potential, not actual standings points. Other
roster moves are held fixed; later trades and replacement signings are not
simulated. Separate trades can affect the same lineup, so summed lift is a
ranking of independent estimates rather than a causal reconstruction of the
season. Team rankings can be ordered by total value, value per rated deal, or
win percentage (the last two only rank teams with at least three rated deals);
the ledger's search and team filter do not change the league rankings.

Two other approaches were considered: value above a league-wide positional
replacement baseline and projected auction/market value. The first misses
team-specific bench depth and flex needs; the second needs reliable historical
projections and prices at trade time. Neither offers as direct an answer to
whether a particular team's roster improved as the lineup comparison. The two
production views provide simpler, observable alternatives.

Run the valuation and ranking checks with `npm test`.
