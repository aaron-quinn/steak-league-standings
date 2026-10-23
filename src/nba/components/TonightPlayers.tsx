import clsx from 'clsx';
import type { NbaGame } from '../lib/data';
import type { TonightTeam } from '../lib/tonight';
import PlayerName from './PlayerName';

const SLOT_LABEL: Record<number, string> = { 12: 'Bench', 13: 'IR' };

// One team's box score for the day: every player with a game, a column per
// category
export default function TonightPlayers({ team }: { team: TonightTeam }) {
  return (
    <div className="nba-box">
      <table>
        <thead>
          <tr>
            <th scope="col" className="player">
              Player
            </th>
            <th scope="col" title="Minutes">MIN</th>
            <th scope="col">PTS</th>
            <th scope="col">REB</th>
            <th scope="col">AST</th>
            <th scope="col">3PM</th>
            <th scope="col">STL</th>
            <th scope="col">BLK</th>
            <th scope="col">FG</th>
            <th scope="col">FT</th>
          </tr>
        </thead>
        <tbody>
          {team.players.map((player) => {
            const line = player.line;
            return (
              <tr
                key={player.id}
                className={clsx({ benched: !player.active, live: player.game.state === 'in' })}
              >
                <th scope="row" className="player">
                  <PlayerName name={player.name} proTeam={player.proTeam} />
                  <span className="when">
                    {!player.active && `${SLOT_LABEL[player.slot]} · `}
                    {gameStatus(player.game, Boolean(line))}
                  </span>
                </th>
                {line ? (
                  <>
                    <td className="min">{player.minutes ?? '–'}</td>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <td key={i}>{line[i]}</td>
                    ))}
                    <td>
                      {line[6]}/{line[7]}
                    </td>
                    <td>
                      {line[8]}/{line[9]}
                    </td>
                  </>
                ) : (
                  <td colSpan={9} className="none">
                    –
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="player">
              Team total
              <span className="when">
                {team.players.some((p) => !p.active && p.line) ? 'Bench and IR not counted' : 'Today'}
              </span>
            </th>
            <td className="min">{team.minutes ?? '–'}</td>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <td key={i}>{team.total[i]}</td>
            ))}
            <td title={`${team.total[6]}/${team.total[7]}`}>{pct(team.total[6], team.total[7])}</td>
            <td title={`${team.total[8]}/${team.total[9]}`}>{pct(team.total[8], team.total[9])}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ".459", or a dash before any shots
const pct = (made: number, tried: number) =>
  tried ? (made / tried).toFixed(3).replace(/^0/, '') : '–';

function gameStatus(game: NbaGame, played: boolean) {
  if (game.state === 'pre') {
    return new Date(game.start).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (game.state === 'in') return played ? game.detail : `${game.detail} · yet to play`;
  return played ? 'Final' : 'Did not play';
}
