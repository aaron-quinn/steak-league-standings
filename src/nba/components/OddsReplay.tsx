import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { formatPoints } from '../lib/format';
import type { OddsHistory } from '../lib/season-odds';
import { shortDate } from '../lib/season';

const percent = (p: number) =>
  p >= 0.995 ? '>99%' : p > 0 && p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`;

const ENDED = { eater: 'Ate 🥩', 'self-buyer': 'Bought own', buyer: 'Bought' };

interface Props {
  history: OddsHistory;
  week: number;
  // Teams tombstoned at that week
  buried?: Set<number>;
  onWeek: (week: number) => void;
  followed: number | null;
  onFollow: (id: number | null) => void;
}

// A finished season played back: the standings and each team's odds as they
// stood at the end of any week, next to how it really ended
export default function OddsReplay({ history, week, buried, onWeek, followed, onFollow }: Props) {
  const { race, eat } = history;
  const end = race.checkpoints.length - 1;
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (week >= end) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => onWeek(week + 1), 650);
    return () => window.clearTimeout(id);
  }, [playing, week, end, onWeek]);

  const rows = [...race.teams].sort((a, b) => a.positions[week] - b.positions[week]);
  const eaters = Math.floor(rows.length / 2);
  const final = week === end;

  return (
    <section className="nba-panel" aria-label="Replay the odds">
      <div className="nba-replay">
        <div className="nba-replay-head">
          <div>
            <span className="nba-replay-kicker">{final ? 'Final' : 'Rewind to'}</span>
            <span className="nba-replay-date">
              {final ? 'How it ended' : `Week of ${shortDate(race.checkpoints[week].date)}`}
            </span>
          </div>
          <div className="nba-replay-buttons">
            <button aria-label="Previous week" disabled={week === 0} onClick={() => onWeek(week - 1)}>
              ‹
            </button>
            <button
              aria-label={playing ? 'Pause' : 'Play the season'}
              className="play"
              onClick={() => {
                if (!playing && week >= end) onWeek(0);
                setPlaying(!playing);
              }}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <button aria-label="Next week" disabled={week === end} onClick={() => onWeek(week + 1)}>
              ›
            </button>
          </div>
        </div>
        <input
          type="range"
          className="nba-range"
          min={0}
          max={end}
          value={week}
          aria-label="Week"
          aria-valuetext={final ? 'Final' : `Week of ${shortDate(race.checkpoints[week].date)}`}
          onChange={(e) => {
            setPlaying(false);
            onWeek(Number(e.target.value));
          }}
          style={{ '--fill': `${(week / Math.max(end, 1)) * 100}%` } as React.CSSProperties}
        />
      </div>
      <table className="nba-table">
        <thead>
          <tr>
            <th className="rank">#</th>
            <th style={{ textAlign: 'left' }}>Team</th>
            <th className="num">{final ? 'Roto points' : 'Eat odds'}</th>
            <th className="num" style={{ paddingRight: 12 }}>
              Ended
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const p = eat.get(t.id)![week];
            const zone = t.zones[end];
            const ate = zone === 'eater';
            // The odds pointed the other way, by a real margin
            const upset = !final && (ate ? p < 0.35 : p > 0.65);
            return (
              <tr
                key={t.id}
                className={clsx(t.zones[week], {
                  'steak-line': t.positions[week] === eaters,
                  followed: t.id === followed,
                })}
                onClick={() => onFollow(followed === t.id ? null : t.id)}
                style={{ cursor: 'pointer' }}
              >
                <td className="rank">{t.positions[week]}</td>
                <td className="team-cell">
                  <span className="who">
                    {t.name}
                    {!final && buried?.has(t.id) && <span title="Tombstoned"> 🪦</span>}
                  </span>
                  <span className="team-name">{formatPoints(t.points[week])} roto points</span>
                </td>
                <td className="num">
                  {final ? (
                    <b className="nba-odds-num">{formatPoints(t.points[week])}</b>
                  ) : (
                    <span className="nba-odds-cell">
                      <b className="nba-odds-num">{percent(p)}</b>
                      <span className="nba-bar" aria-hidden="true">
                        <span style={{ width: `${Math.round(p * 100)}%` }} />
                      </span>
                    </span>
                  )}
                </td>
                <td className="num" style={{ paddingRight: 12 }}>
                  <span className={clsx('nba-ended', { ate, upset })}>
                    {upset && <span className="nba-upset">Upset</span>}
                    {ENDED[zone]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
