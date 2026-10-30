import { Link, useParams } from 'react-router-dom';
import Shell, { Loading, useSeason } from '../components/Shell';
import type { PlayerPool } from '../lib/comps';
import { type GameLogLine, useGameLog, useLeague, useSeasonDays, useSeasonPool } from '../lib/data';
import { slugify } from '../lib/people';
import { seasonLabel, shortDate } from '../lib/season';

const BENCH = 12;
const IR = 13;
const COUNTING = ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK'];
const CATS = [...COUNTING, 'FG%', 'FT%'];
// The players a line is ranked among: those who have played this share of
// the most games anyone has, at this many minutes a game
const REGULAR_GAMES = 0.4;
const REGULAR_MINUTES = 10;

// The fantasy day a game counted on: its Eastern date, from opening night
const dayOf = (opener: string, date: string) =>
  Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${opener}T12:00:00Z`)) / 86_400_000) + 1;

const ratio = (made: number, tried: number) => (tried ? made / tried : undefined);
const shownPct = (v: number | undefined) => (v === undefined ? '—' : v.toFixed(3).replace(/^0/, ''));

// [games, minutes, ...per-game counting stats, FG%, FT%] from summed totals
// laid out as [games, minutes, PTS, REB, AST, 3PM, STL, BLK, FGM, FGA, FTM, FTA]
function perGame([games, minutes, ...t]: number[]) {
  return {
    games,
    minutes: minutes / games,
    cats: [...t.slice(0, 6).map((v) => v / games), ratio(t[6], t[7]), ratio(t[8], t[9])],
  };
}

function sumGames(games: GameLogLine[]) {
  const sum = Array<number>(12).fill(0);
  for (const game of games) {
    sum[0] += 1;
    for (let i = 5; i < 16; i++) sum[i - 4] += Number(game[i]);
  }
  return sum;
}

// Each category's per-game values among the season's regulars, sorted
function regulars(pool: PlayerPool | undefined) {
  if (!pool) return undefined;
  const most = Math.max(0, ...pool.players.map((p) => p[1]));
  const lines = pool.players
    .filter((p) => p[1] >= most * REGULAR_GAMES && p[2] / p[1] >= REGULAR_MINUTES)
    .map((p) => perGame(p.slice(1) as number[]).cats);
  return CATS.map((_, i) =>
    lines.map((line) => line[i]).filter((v): v is number => v !== undefined).sort((a, b) => a - b),
  );
}

// Share of regulars below v, ties counting half
function percentile(sorted: number[], v: number) {
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return (below + equal / 2) / sorted.length;
}

// Cyan above the middle, pink below, stronger toward either end
function heat(p: number) {
  const strength = Math.round(Math.abs(p - 0.5) * 2 * 48);
  const color = p >= 0.5 ? 'var(--cyan)' : 'var(--bad-text)';
  return `color-mix(in srgb, ${color} ${strength}%, transparent)`;
}

function StatRow({ sum, ranks }: { sum: number[]; ranks?: number[][] }) {
  if (!sum[0]) return null;
  const { games, minutes, cats } = perGame(sum);
  return (
    <tr>
      {cats.map((v, i) => {
        const p = v !== undefined && ranks?.[i].length ? percentile(ranks[i], v) : undefined;
        return (
          <td
            key={CATS[i]}
            className="cat"
            style={p === undefined ? undefined : { background: heat(p) }}
            title={p === undefined ? undefined : `Better than ${Math.round(p * 100)}% of regulars`}
          >
            {i < 6 ? v?.toFixed(1) : shownPct(v)}
          </td>
        );
      })}
      <td className="extra">{games}</td>
      <td>{minutes.toFixed(1)}</td>
    </tr>
  );
}

export default function PlayerPage() {
  const { name = '' } = useParams();
  const [season] = useSeason();
  const { data: league } = useLeague(season);
  const history = useSeasonDays(season);
  const pool = useSeasonPool(season);
  const ids = new Set(
    Object.entries(history.names).filter(([, n]) => n === name).map(([id]) => Number(id)),
  );
  const log = useGameLog(season, [...ids][0]);

  // Who had the player on each day they played: [fantasy team, lineup slot]
  const rostered = new Map<number, [number, number]>();
  for (const day of history.days ?? []) {
    const line = day.players.find((p) => ids.has(p[1]) && p[3] > 0);
    if (line) rostered.set(day.day, [line[0], line[2]]);
  }

  const games = (log.data?.games ?? []).map((game) => ({
    game,
    owner: league ? rostered.get(dayOf(league.opener, game[0])) : undefined,
  }));
  const ranks = regulars(pool.data?.season === season ? pool.data : undefined);
  const teamOf = (id: number) => league?.teams.find((t) => t.id === id);
  const pending = history.isPending || (ids.size > 0 && log.isPending);

  return (
    <Shell title={name}>
      <section className="nba-panel">
        <div className="nba-panel-head"><h3 className="nba-panel-title">{seasonLabel(season)} season</h3></div>
        {pending ? <Loading /> : games.length ? (
          <div className="nba-player-log nba-player-season"><table><thead><tr>
            {CATS.map((c) => <th scope="col" key={c}>{c}</th>)}
            <th scope="col" className="extra">G</th><th scope="col">MIN</th>
          </tr></thead><tbody>
            <StatRow sum={sumGames(games.map((g) => g.game))} ranks={ranks} />
          </tbody></table></div>
        ) : <p className="nba-player-note">{log.isError ? 'Season stats could not be loaded.' : 'No games found for this player and season.'}</p>}
      </section>
      {games.length > 0 && (
        <section className="nba-panel">
          <div className="nba-panel-head"><h3 className="nba-panel-title">Game log</h3></div>
          <div className="nba-player-log"><table><thead><tr>
            <th scope="col">Date</th><th scope="col">Roster</th><th scope="col">MIN</th>
            {COUNTING.map((s) => <th scope="col" key={s}>{s}</th>)}<th scope="col">FG</th><th scope="col">FT</th><th scope="col">Opp</th>
          </tr></thead><tbody>
            {games.slice().reverse().map(({ game, owner }) => {
              const team = owner && teamOf(owner[0]);
              const sat = owner && (owner[1] === BENCH || owner[1] === IR);
              return (
                <tr key={game[0]} className={owner ? 'rostered' : undefined}>
                  <th scope="row">{shortDate(new Date(`${game[0]}T12:00:00Z`))}</th>
                  <td>
                    {team ? <><Link to={`/nba/managers/${slugify(team.owner)}`} className="who" title={team.owner}>{team.owner.split(' ').pop()}</Link>{sat && <span className="sat" title={owner[1] === IR ? 'On injured reserve' : 'On the bench'}>{owner[1] === IR ? 'IR' : 'BN'}</span>}</> : '—'}
                  </td>
                  <td>{game[5]}</td>
                  {game.slice(6, 12).map((v, j) => <td key={j}>{v}</td>)}
                  <td>{game[12]}–{game[13]}</td><td>{game[14]}–{game[15]}</td>
                  <td>{game[2] === '@' ? '@' : 'vs'} {game[3]} <span className={game[4] === 'W' ? 'won' : 'lost'}>{game[4]}</span></td>
                </tr>
              );
            })}
          </tbody></table></div>
        </section>
      )}
    </Shell>
  );
}
