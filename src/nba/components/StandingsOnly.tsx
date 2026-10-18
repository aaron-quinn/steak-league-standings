import { seasonLabel } from '../lib/season';

// 2017-18, the league's first season, was played on Yahoo, which kept only the
// final standings: no daily rosters, auction or transactions. The screens built
// from daily lineups say so, rather than looking broken or empty.
export default function StandingsOnly({
  season,
  what,
}: {
  season: number;
  what: string;
}) {
  return (
    <div className="nba-panel">
      <div className="nba-empty">
        <b>
          No {what} for {seasonLabel(season)}
        </b>
        That season was played on Yahoo, which kept only the final standings, so
        there is no day-by-day record to read. Its final standings are on the
        Standings page.
      </div>
    </div>
  );
}
