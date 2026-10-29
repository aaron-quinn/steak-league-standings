import { useParams } from 'react-router-dom';
import Shell, { Loading, useSeason } from '../components/Shell';
import { useLeague, usePlayerPool, useSeasonDays } from '../lib/data';
import { dateOfDay, shortDate, seasonLabel } from '../lib/season';

export default function PlayerPage() {
  const { name = '' } = useParams();
  const [season] = useSeason();
  const { data: league } = useLeague(season);
  const pool = usePlayerPool(season);
  const history = useSeasonDays(season);
  const matches = Object.entries(history.names).filter(([, n]) => n === name);
  const ids = new Set(matches.map(([id]) => Number(id)));
  const lines = (history.days ?? []).flatMap((day) =>
    day.players.filter((p) => ids.has(p[1]) && p[3] > 0).map((p) => ({ day: day.day, stats: p.slice(4) })),
  ).reverse();
  const player = pool.data?.season === season ? pool.data.players.find((p) => p[0] === name) : undefined;
  return (
    <Shell title={name}>
      <section className="nba-panel">
        <div className="nba-panel-head"><h3 className="nba-panel-title">{seasonLabel(season)} season</h3></div>
        {pool.isPending ? <Loading /> : player ? (
          <div className="nba-player-summary">
            <span><strong>{player[1]}</strong> games</span>
            {['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK'].map((label, i) => (
              <span key={label}><strong>{player[1] ? (Number(player[i + 3]) / player[1]).toFixed(1) : '—'}</strong> {label} / game</span>
            ))}
          </div>
        ) : <p className="nba-player-note">Season totals are unavailable for this player and season.</p>}
      </section>
      <section className="nba-panel">
        <div className="nba-panel-head"><h3 className="nba-panel-title">Rostered game log</h3></div>
        <p className="nba-player-note">Games recorded while on a league roster. This may not include every NBA game played.</p>
        {history.isPending ? <Loading /> : history.isError ? <p className="nba-player-note">Game log could not be loaded.</p> : lines.length && league ? (
          <div className="nba-player-log"><table><thead><tr><th scope="col">Date</th>{['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FG', 'FT'].map((s) => <th scope="col" key={s}>{s}</th>)}</tr></thead><tbody>
            {lines.map(({ day, stats }, i) => <tr key={`${day}-${i}`}><th scope="row">{shortDate(dateOfDay(league.opener, day))}</th>{stats.slice(0, 6).map((v, j) => <td key={j}>{v}</td>)}<td>{stats[6]}–{stats[7]}</td><td>{stats[8]}–{stats[9]}</td></tr>)}
          </tbody></table></div>
        ) : <p className="nba-player-note">No rostered games found for this season.</p>}
      </section>
    </Shell>
  );
}
