import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import FollowSelect from '../components/FollowSelect';
import OddsChart from '../components/OddsChart';
import OddsReplay from '../components/OddsReplay';
import SeasonStatus from '../components/SeasonStatus';
import Shell, { Loading, useSeason } from '../components/Shell';
import StandingsOnly from '../components/StandingsOnly';
import TombstonePit from '../components/TombstonePit';
import { formatPoints } from '../lib/format';
import { oddsConfidence, oddsStories } from '../lib/season-odds';
import { isFinished } from '../lib/season';
import { buildStandings, hasStarted, steakZone } from '../lib/standings';
import { useSteakOdds } from '../lib/useSteakOdds';

const percent = (p: number) =>
  p >= 0.995 ? '>99%' : p > 0 && p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`;

// The odds as shown, so rows that read the same tie: >99% is 100, <1% falls
// between 0% and 1%
const shown = (p: number) => (p >= 0.995 ? 100 : p > 0 && p < 0.005 ? 0.5 : Math.round(p * 100));

export default function OddsPage() {
  const [season] = useSeason();
  const { league, model, history, now, pitNow, pitAt } = useSteakOdds(season);
  const [followed, setFollowed] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const finished = isFinished(season);

  // Best chance of eating first, as shown; ties go to the better shot at first,
  // then the standings
  const rows = useMemo(() => {
    const standings = league ? buildStandings(league.teams) : [];
    const odds = (id: number) => {
      const o = now?.get(id);
      return o ? { eat: shown(o.eat), first: shown(o.first) } : { eat: -1, first: -1 };
    };
    return standings.sort(
      (a, b) =>
        odds(b.team.id).eat - odds(a.team.id).eat ||
        odds(b.team.id).first - odds(a.team.id).first ||
        a.position - b.position,
    );
  }, [league, now]);
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
      ) : finished && history && history.race.checkpoints.length === 0 ? (
        <StandingsOnly season={season} what="odds" />
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
                  {(() => {
                    const { skill, level } = oddsConfidence(league.latestDay);
                    return (
                      <span
                        className="nba-confidence"
                        title={`At this point in past seasons, these odds were ${Math.round(skill * 100)}% better than a coin flip`}
                      >
                        Odds confidence
                        <span className="nba-bar" aria-hidden="true">
                          <span style={{ width: `${Math.round(skill * 100)}%` }} />
                        </span>
                        <b>{level}</b>
                      </span>
                    );
                  })()}
                </div>
                <table className="nba-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingLeft: 12 }}>Team</th>
                      <th className="num">1st</th>
                      <th className="num" style={{ paddingRight: 12 }}>
                        Eat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const odds = now?.get(row.team.id);
                      const buried = pit?.buried.has(row.team.id) ?? false;
                      // Zones by place in the odds order, with the steak line
                      // drawn the way the standings draw it
                      const zone = steakZone(i + 1, rows.length);
                      const eaters = Math.floor(rows.length / 2);
                      const lineAfter = rows.length % 2 ? eaters + 1 : eaters;
                      return (
                        <tr
                          key={row.team.id}
                          className={clsx(zone, {
                            leader: i === 0,
                            'steak-line': i + 1 === lineAfter,
                            followed: row.team.id === followed,
                          })}
                          onClick={() => setFollowed(followed === row.team.id ? null : row.team.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="team-cell" style={{ paddingLeft: 12 }}>
                            <span className="who">
                              {row.name}
                              {buried && <span title="Tombstoned"> 🪦</span>}
                            </span>
                            <span className="team-name">
                              {formatPoints(row.points)} roto points
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
                from its pace per game in every category (so an early run of
                extra games isn&rsquo;t assumed to last), with the swings that
                past seasons (2018–19 on) actually showed; a past season&rsquo;s
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
