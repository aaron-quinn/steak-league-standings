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
