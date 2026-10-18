import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import FollowSelect from '../components/FollowSelect';
import OddsChart from '../components/OddsChart';
import OddsReplay from '../components/OddsReplay';
import SeasonStatus from '../components/SeasonStatus';
import Shell, { Loading, useSeason } from '../components/Shell';
import TombstonePit from '../components/TombstonePit';
import { formatPoints, ordinal } from '../lib/format';
import { oddsStories } from '../lib/season-odds';
import { isFinished } from '../lib/season';
import { buildStandings, hasStarted } from '../lib/standings';
import { useSteakOdds } from '../lib/useSteakOdds';

const percent = (p: number) =>
  p >= 0.995 ? '>99%' : p > 0 && p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`;

export default function OddsPage() {
  const [season] = useSeason();
  const { league, model, history, now, pitNow, pitAt } = useSteakOdds(season);
  const [followed, setFollowed] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const finished = isFinished(season);

  const rows = useMemo(() => (league ? buildStandings(league.teams) : []), [league]);
  const stories = useMemo(
    () => (finished && history ? oddsStories(history, (w) => pitAt(w)?.buried ?? new Set()) : []),
    [finished, history, pitAt],
  );

  // A replay opens halfway through the season: early weeks are all coin
  // flips, late ones mostly settled
  const end = (history?.race.checkpoints.length ?? 1) - 1;
  useEffect(() => setWeek(null), [season]);
  const shownWeek = Math.min(week ?? Math.floor(end / 2), end);
  const pit = finished ? pitAt(shownWeek) : pitNow;

  const loading = !league || !model || (finished && !history);
  return (
    <Shell title="Steak Odds" status={league && <SeasonStatus league={league} />}>
      {loading ? (
        <Loading label="Running the odds" />
      ) : !hasStarted(league) ? (
        <div className="nba-panel">
          <div className="nba-empty">
            <b>No odds yet</b>They start once the first games are in.
          </div>
        </div>
      ) : (
        <>
          {finished && stories.length > 0 && (
            <dl className="nba-facts" style={{ marginBottom: 16 }}>
              {stories.map((story) => (
                <div
                  key={story.label}
                  className="nba-fact clickable"
                  onClick={() => {
                    if (story.week !== undefined) setWeek(story.week);
                    if (story.teamID !== undefined) setFollowed(story.teamID);
                  }}
                >
                  <dt>{story.label}</dt>
                  <dd>
                    <span className="big">{story.value}</span>
                    <span className="small">{story.detail}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="nba-grid">
            {finished && history ? (
              <OddsReplay
                history={history}
                week={shownWeek}
                buried={pit?.buried}
                onWeek={setWeek}
                followed={followed}
                onFollow={setFollowed}
              />
            ) : (
              <section className="nba-panel" aria-label="Chances of eating steak">
                <div className="nba-panel-head">
                  <h3 className="nba-panel-title">Chance of eating</h3>
                </div>
                <table className="nba-table">
                  <thead>
                    <tr>
                      <th className="rank">#</th>
                      <th style={{ textAlign: 'left' }}>Team</th>
                      <th className="num">1st</th>
                      <th className="num" style={{ paddingRight: 12 }}>
                        Eat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const odds = now?.get(row.team.id);
                      const buried = pit?.buried.has(row.team.id) ?? false;
                      return (
                        <tr
                          key={row.team.id}
                          className={clsx(row.zone, { leader: row.position === 1, followed: row.team.id === followed })}
                          onClick={() => setFollowed(followed === row.team.id ? null : row.team.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="rank">{row.position}</td>
                          <td className="team-cell">
                            <span className="who">
                              {row.name}
                              {buried && <span title="Tombstoned"> 🪦</span>}
                            </span>
                            <span className="team-name">
                              {formatPoints(row.points)} roto points
                              {odds && ` · projects ${ordinal(Math.round(odds.position))}`}
                            </span>
                          </td>
                          <td className="num nba-dim">{odds ? percent(odds.first) : '–'}</td>
                          <td className={clsx('num pts', { 'nba-faint': buried })}>
                            {odds ? percent(odds.eat) : '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}
            <div>
              <section className="nba-panel" aria-label="Odds over the season">
                <div className="nba-panel-head">
                  <h3 className="nba-panel-title">Week by week</h3>
                  {history && (
                    <FollowSelect teams={history.race.teams} value={followed} onChange={setFollowed} />
                  )}
                </div>
                <div className="nba-panel-body">
                  {history && history.race.checkpoints.length > 1 ? (
                    <OddsChart
                      history={history}
                      followed={followed}
                      onFollow={setFollowed}
                      marker={finished ? shownWeek : undefined}
                      onPickWeek={finished ? setWeek : undefined}
                    />
                  ) : (
                    <p className="nba-dim" style={{ margin: 0 }}>
                      The chart starts after the first full week.
                    </p>
                  )}
                </div>
              </section>
              {pit && (
                <div style={{ marginTop: 16 }}>
                  <TombstonePit pit={pit} />
                </div>
              )}
              <p className="nba-foot">
                {finished
                  ? 'Drag the slider or press play to watch the season unfold: each week shows the odds as they stood then, next to how it really ended. Tap a card to jump to its moment. '
                  : ''}
                Each team&rsquo;s rest of season is simulated thousands of times
                from its pace in every category, with the swings that past
                seasons (2018–19 on) actually showed; a past season&rsquo;s
                odds never see that season. Checked season by season against
                what happened, it beat ranking by current position in 7 of 8
                seasons.
              </p>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
