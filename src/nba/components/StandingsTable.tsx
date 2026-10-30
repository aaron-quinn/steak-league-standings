import StandingsName from './StandingsName';
import clsx from 'clsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPoints, ordinal } from '../lib/format';
import { slugify } from '../lib/people';
import type { StandingRow } from '../lib/standings';
import type { TonightTeam } from '../lib/tonight';
import TonightPlayers from './TonightPlayers';

interface Props {
  rows: StandingRow[];
  // Show what ESPN's own final standings said, for seasons that ended early
  showESPN?: boolean;
  // Teams tombstoned right now (live season)
  buried?: Set<number>;
  // Places each team has moved today, and its players' games today (live season)
  moves?: Map<number, number>;
  tonight?: Map<number, TonightTeam>;
  liveSeason?: boolean;
}

// Active lineup slots (1 C, 3 G, 3 F, 2 UTIL): one segment each
const SLOTS = 9;

// How far through the day a team's active players are, after the NFL
// standings: a segment per game, done, playing now (pulsing) or still to play,
// then empty placeholders for the slots with no game, so every bar is the
// same length. Opens the team's players.
function GamesBar({
  games,
  open,
  onToggle,
}: {
  games: TonightTeam;
  open: boolean;
  onToggle: () => void;
}) {
  const { done, playing, toPlay } = games;
  const total = done + playing + toPlay;
  const label = `Games today: ${done} done, ${playing} playing, ${toPlay} yet to play`;
  const state = (i: number) =>
    i < done ? 'done' : i < done + playing ? 'playing' : i < total ? 'to-play' : 'empty';
  return (
    <button
      type="button"
      className="nba-games"
      aria-expanded={open}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <span className={clsx('bar', { over: total > 0 && playing + toPlay === 0 })} aria-hidden="true">
        {Array.from({ length: Math.max(SLOTS, total) }, (_, i) => (
          <span key={i} className={state(i)} />
        ))}
      </span>
      <span className="chev" aria-hidden="true" />
    </button>
  );
}

export default function StandingsTable({
  rows,
  showESPN = false,
  buried,
  moves,
  tonight,
  liveSeason = false,
}: Props) {
  const [opened, setOpened] = useState<Set<number>>(() => new Set());
  const toggle = (id: number) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const eaters = rows.filter((r) => r.zone === 'eater').length;
  const lineAfter = rows.some((r) => r.zone === 'self-buyer')
    ? eaters + 1
    : eaters;
  return (
    <table className="nba-table">
      <caption className="sr-only">
        Roto standings. The top {eaters} eat steak
        {lineAfter > eaters && `; ${ordinal(eaters + 1)} buys their own`}.
      </caption>
      <thead>
        <tr>
          <th className="rank" scope="col">
            #
          </th>
          <th scope="col" style={{ textAlign: 'left' }}>
            Team
          </th>
          {tonight && (
            <th className="num games" scope="col">
              Games
            </th>
          )}
          {moves && (
            <th className="num move" scope="col">
              Today
            </th>
          )}
          <th className="num" scope="col" style={{ paddingRight: 12 }}>
            Roto points
          </th>
        </tr>
      </thead>
      {rows.map((row) => {
        const tied = rows.some((o) => o !== row && o.rank === row.rank);
        const differs = showESPN && row.team.espn.rank !== row.rank;
        const move = moves?.get(row.team.id) ?? 0;
        const games = tonight?.get(row.team.id);
        const canOpen = Boolean(games?.players.length);
        const open = canOpen && opened.has(row.team.id);
        const onLine = row.position === lineAfter;
        // Each team gets its own body, so its players can open beneath it
        return (
          <tbody key={row.team.id} className="team">
            <tr
              className={clsx(row.zone, {
                leader: row.position === 1,
                'steak-line': onLine && !open,
                openable: canOpen,
                open,
              })}
              onClick={canOpen ? () => toggle(row.team.id) : undefined}
            >
              <td className="rank">
                {tied ? 'T' : ''}
                {row.rank}
              </td>
              <td className="team-cell">
                {/* In the live season the whole row opens the day's players,
                    so the name isn't a link there */}
                {row.team.owner && !liveSeason ? (
                  <Link to={`/nba/managers/${slugify(row.name)}`} className="who">
                    <StandingsName name={row.name} hasOwner={Boolean(row.team.owner)} />
                    {buried?.has(row.team.id) && <span title="Tombstoned"> 🪦</span>}
                    {row.zone === 'self-buyer' && (
                      <span className="nba-zone-tag">Buys own</span>
                    )}
                  </Link>
                ) : (
                  <span className="who">
                    <StandingsName name={row.name} hasOwner={Boolean(row.team.owner)} />
                    {buried?.has(row.team.id) && <span title="Tombstoned"> 🪦</span>}
                    {row.zone === 'self-buyer' && (
                      <span className="nba-zone-tag">Buys own</span>
                    )}
                  </span>
                )}
                <span className="team-name">
                  {row.team.owner ? row.team.name : 'No owner yet'}
                  {differs && (
                    <span className="espn">
                      {' '}
                      · ESPN had {ordinal(row.team.espn.rank)}
                    </span>
                  )}
                </span>
              </td>
              {tonight && (
                <td className="num games">
                  {canOpen && (
                    <GamesBar games={games!} open={open} onToggle={() => toggle(row.team.id)} />
                  )}
                </td>
              )}
              {moves && (
                <td
                  className={clsx('num move', { up: move > 0, down: move < 0 })}
                  aria-label={
                    move
                      ? `${move > 0 ? 'Up' : 'Down'} ${Math.abs(move)} today`
                      : 'No change today'
                  }
                >
                  {move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : <span className="nba-faint">–</span>}
                </td>
              )}
              <td className="num pts">{formatPoints(row.points)}</td>
            </tr>
            {open && (
              <tr className={clsx('nba-box-row', { 'steak-line': onLine })}>
                <td colSpan={3 + (moves ? 1 : 0) + (tonight ? 1 : 0)}>
                  <TonightPlayers team={games!} />
                </td>
              </tr>
            )}
          </tbody>
        );
      })}
    </table>
  );
}
