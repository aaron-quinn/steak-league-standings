import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PlayerName from '../components/PlayerName';
import RowValue, { signed } from '../components/RowValue';
import SeasonStatus from '../components/SeasonStatus';
import StandingsOnly from '../components/StandingsOnly';
import Shell, {
  AllTimeToggle,
  Loading,
  SeasonPicker,
  useAllTime,
  useSeason,
} from '../components/Shell';
import type { NbaLeague } from '../lib/data';
import { ordinal } from '../lib/format';
import { summarizeInjuries, type InjurySummary, type TeamInjuries } from '../lib/injuries';
import { slugify } from '../lib/people';
import { dateOfDay, isFinished, seasonLabel, shortDate } from '../lib/season';
import { personName } from '../lib/standings';
import { hasInjuries, useAllInjuries, useInjuries } from '../lib/useInjuries';

type Sort = 'luck' | 'lost' | 'kept';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'luck', label: 'Worst luck' },
  { value: 'lost', label: 'Most lost' },
  { value: 'kept', label: 'Kept in' },
];

const sorters: Record<Sort, (a: TeamInjuries, b: TeamInjuries) => number> = {
  luck: (a, b) => a.luck - b.luck,
  lost: (a, b) => b.points - a.points,
  kept: (a, b) => b.keptInPoints - a.keptInPoints,
};

// All absences, or only runs of two or more games (likely injuries)
function AbsenceFilter({ multiOnly, onChange }: { multiOnly: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="nba-seg" role="group" aria-label="Which absences count">
      <button aria-pressed={!multiOnly} onClick={() => onChange(false)} title="Every game a starter missed">
        All absences
      </button>
      <button aria-pressed={multiOnly} onClick={() => onChange(true)} title="Only absences of two or more games in a row">
        Multi-game
      </button>
    </div>
  );
}

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');

export default function InjuriesPage() {
  const [season] = useSeason();
  const [allTime] = useAllTime();
  const [multiOnly, setMultiOnly] = useState(false);

  return (
    <Shell
      title="Injuries"
      status={allTime ? <span>Every finished season since 2018–19</span> : <SeasonHeadStatus season={season} />}
      tools={
        <div className="nba-tools">
          <AbsenceFilter multiOnly={multiOnly} onChange={setMultiOnly} />
          {!allTime && <SeasonPicker />}
          <AllTimeToggle />
        </div>
      }
    >
      {allTime ? (
        <AllTimeView multiOnly={multiOnly} />
      ) : !hasInjuries(season) ? (
        <StandingsOnly season={season} what="lineups" />
      ) : (
        <SeasonView season={season} multiOnly={multiOnly} />
      )}
    </Shell>
  );
}

function SeasonHeadStatus({ season }: { season: number }) {
  const { league } = useInjuries(season);
  return league ? <SeasonStatus league={league} /> : null;
}

function Who({ league, id }: { league: NbaLeague; id: number }) {
  const team = league.teams.find((t) => t.id === id);
  if (!team) return null;
  return (
    <>
      {team.owner ? (
        <Link to={`/nba/managers/${slugify(team.owner)}`} className="who">
          {team.owner}
        </Link>
      ) : (
        <span className="who">{team.name}</span>
      )}
      {team.name !== team.owner && <span className="team-name">{team.name}</span>}
    </>
  );
}

function SeasonView({ season, multiOnly }: { season: number; multiOnly: boolean }) {
  const { league, data, names, proTeams, isPending } = useInjuries(season);
  const [sort, setSort] = useState<Sort>('luck');
  const summary = useMemo(
    () => (league && data ? summarizeInjuries(data, league, { multiOnly }) : null),
    [league, data, multiOnly],
  );

  if (isPending || !league || !summary) return <Loading label="Counting missed games" />;
  if (summary.teams.every((t) => t.starts === 0)) {
    return (
      <div className="nba-panel">
        <div className="nba-empty">
          <b>No games yet</b>Missed games show up the day after they happen.
        </div>
      </div>
    );
  }

  const teams = [...summary.teams].sort(sorters[sort]);
  const ownerOf = (id: number) => {
    const t = league.teams.find((x) => x.id === id);
    return t ? personName(t) : '';
  };
  const worst = [...summary.teams].sort(sorters.luck)[0];
  const mostKept = [...summary.teams].sort(sorters.kept)[0];
  const swing = [...summary.teams].sort((a, b) => b.rank - b.healthyRank - (a.rank - a.healthyRank))[0];
  const top = summary.absences[0];
  const nameOf = (id: number) => names[id] ?? `Player ${id}`;
  const live = !isFinished(season);

  return (
    <>
      <dl className="nba-facts nba-injury-facts">
        <div className="nba-fact">
          <dt>Unluckiest</dt>
          <dd>
            <span className="big">{ownerOf(worst.id)}</span>
            <span className="small">{signed(worst.luck)} pts against expected</span>
          </dd>
        </div>
        {top && (
          <div className="nba-fact">
            <dt>Costliest absence</dt>
            <dd>
              <span className="big">{nameOf(top.player)}</span>
              <span className="small">
                {top.lost} lineup games, {top.points.toFixed(1)} pts for {ownerOf(top.team)}
              </span>
            </dd>
          </div>
        )}
        {swing.rank !== swing.healthyRank && (
          <div className="nba-fact">
            <dt>Healthy, would be</dt>
            <dd>
              <span className="big">
                {ownerOf(swing.id)} {ordinal(swing.healthyRank)}
              </span>
              <span className="small">not {ordinal(swing.rank)}</span>
            </dd>
          </div>
        )}
        {mostKept.keptIn > 0 && (
          <div className="nba-fact">
            <dt>Kept the injured in</dt>
            <dd>
              <span className="big">{ownerOf(mostKept.id)}</span>
              <span className="small">
                {mostKept.keptIn} games, {mostKept.keptInPoints.toFixed(1)} pts
              </span>
            </dd>
          </div>
        )}
      </dl>

      <div className="nba-grid">
        <div className="nba-injury-main">
          <section className="nba-panel" aria-label="Injury luck by team">
            <div className="nba-panel-head">
              <h3 className="nba-panel-title">Injury luck</h3>
              <div className="nba-seg" role="group" aria-label="Sort teams">
                {SORTS.map((s) => (
                  <button key={s.value} aria-pressed={sort === s.value} onClick={() => setSort(s.value)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="nba-scroll">
              <table className="nba-table nba-injury-table">
                <thead>
                  <tr>
                    <th className="rank" scope="col">#</th>
                    <th className="team-cell" scope="col" style={{ textAlign: 'left' }}>Manager</th>
                    <th className="num" scope="col" title="Games a starter's NBA team played without him">Lost</th>
                    <th className="num" scope="col" title="Lost games valued in roto points, at each player's per-game line">Pts lost</th>
                    <th className="num" scope="col" title="Games lost while the player was already out when the week's lineup locked">Kept in</th>
                    <th className="num" scope="col" title="Points a league-average share of surprise absences would have cost, given each starter's last two seasons">Expected</th>
                    <th className="num" scope="col" title="Expected minus points lost to surprise absences. Below zero is bad luck">Luck</th>
                    <th className="num healthy" scope="col" title="Finish with every lost game filled at the player's per-game line">Healthy</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const move = t.rank - t.healthyRank;
                    return (
                      <tr key={t.id}>
                        <td className="rank">{i + 1}</td>
                        <td className="team-cell">
                          <Who league={league} id={t.id} />
                        </td>
                        <td className="num">
                          <b>{t.lost}</b>
                          <small>{pct(t.lost, t.starts)}</small>
                        </td>
                        <td className="num">
                          <b>{t.points.toFixed(1)}</b>
                        </td>
                        <td className="num">
                          <b>{t.keptIn}</b>
                          <small>{t.keptInPoints.toFixed(1)} pts</small>
                        </td>
                        <td className="num">
                          <b className="nba-dim">{t.expectedPoints.toFixed(1)}</b>
                        </td>
                        <td className={clsx('num luck', { 'nba-good': t.luck >= 0.05, 'nba-bad': t.luck <= -0.05 })}>
                          {signed(t.luck)}
                        </td>
                        <td className="num healthy">
                          <b>{ordinal(t.healthyRank)}</b>
                          <small className={clsx({ 'nba-good': move > 0, 'nba-bad': move < 0 })}>
                            {move === 0 ? 'same' : `was ${ordinal(t.rank)}`}
                          </small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="nba-foot nba-panel-foot">
              A game is lost when a starter’s NBA team played without him: injury, rest or a coach’s call. Bench
              and IR stashes don’t count. <b>Kept in</b> games are ones where he was already out when the week’s
              lineup locked; the rest were surprises. <b>Luck</b> compares surprise losses with what each
              starter’s last two seasons predicted, so drafting a fragile star isn’t bad luck. Points are the
              roto-point value of each player’s per-game line, as on the Waivers page; <b>Healthy</b> reruns the
              standings with every lost game filled in.
              {live && ' Today’s games count from tomorrow.'}
            </p>
          </section>

          <WeekHeatmap summary={summary} league={league} order={teams.map((t) => t.id)} />
        </div>

        <section className="nba-panel" aria-label="Costliest absences">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Costliest absences</h3>
          </div>
          <div className="nba-metric-heading nba-metric-heading-panel">Roto points lost</div>
          <ul className="nba-rows">
            {summary.absences.slice(0, 15).map((a) => (
              <li key={`${a.team}-${a.player}-${a.from}`} className="nba-row">
                <span className="nba-row-main">
                  <span className="nba-row-title">
                    <PlayerName name={nameOf(a.player)} proTeam={proTeams[a.player]} />
                  </span>
                  <span className="nba-row-sub">
                    {ownerOf(a.team)} · {shortDate(dateOfDay(league.opener, a.from))}
                    {a.to !== a.from && `–${shortDate(dateOfDay(league.opener, a.to))}`}
                  </span>
                  <span className="nba-row-sub">
                    {a.lost} in the lineup{a.length > a.lost && ` of ${a.length} missed`}
                    {a.keptIn > 0 && ` · ${a.keptIn} kept in`}
                  </span>
                </span>
                <RowValue value={a.points} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function WeekHeatmap({ summary, league, order }: { summary: InjurySummary; league: NbaLeague; order: number[] }) {
  const byId = new Map(summary.teams.map((t) => [t.id, t]));
  const max = Math.max(1, ...summary.teams.flatMap((t) => t.weeks.map((w) => w.games)));
  return (
    <section className="nba-panel" aria-label="Games lost by week">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Games lost by week</h3>
      </div>
      <div className="nba-scroll">
        <table className="nba-table nba-injury-heat">
          <thead>
            <tr>
              <th className="team-cell sticky" scope="col" style={{ textAlign: 'left' }}>Manager</th>
              {summary.weeks.map((w) => (
                <th key={w.index} scope="col" title={`${shortDate(dateOfDay(league.opener, w.first))}–${shortDate(dateOfDay(league.opener, w.last))}`}>
                  {w.index}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((id) => {
              const t = byId.get(id)!;
              const team = league.teams.find((x) => x.id === id)!;
              return (
                <tr key={id}>
                  <th className="team-cell sticky" scope="row">
                    <span className="who">{personName(team)}</span>
                  </th>
                  {t.weeks.map((w, i) => {
                    const week = summary.weeks[i];
                    return (
                      <td
                        key={week.index}
                        style={{ '--heat': `rgb(255 82 134 / ${(w.games / max) * 0.75})` } as React.CSSProperties}
                        title={`Week ${week.index}, ${shortDate(dateOfDay(league.opener, week.first))}–${shortDate(dateOfDay(league.opener, week.last))}: ${w.games} ${w.games === 1 ? 'game' : 'games'} lost, ${w.points.toFixed(1)} pts`}
                      >
                        {w.games || ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AllTimeView({ multiOnly }: { multiOnly: boolean }) {
  const { seasons, isPending } = useAllInjuries(true);
  const rows = useMemo(
    () =>
      seasons.flatMap(({ season, data, league }) =>
        summarizeInjuries(data, league, { multiOnly }).teams.flatMap((t) => {
          const team = league.teams.find((x) => x.id === t.id);
          return team?.owner ? [{ ...t, season, owner: team.owner, teamName: team.name }] : [];
        }),
      ),
    [seasons, multiOnly],
  );
  const careers = useMemo(() => {
    const byOwner = new Map<string, { owner: string; seasons: number; luck: number; lost: number; keptIn: number }>();
    for (const r of rows) {
      const c = byOwner.get(r.owner) ?? { owner: r.owner, seasons: 0, luck: 0, lost: 0, keptIn: 0 };
      c.seasons++;
      c.luck += r.luck;
      c.lost += r.lost;
      c.keptIn += r.keptIn;
      byOwner.set(r.owner, c);
    }
    return [...byOwner.values()].sort((a, b) => a.luck / a.seasons - b.luck / b.seasons);
  }, [rows]);

  if (isPending) return <Loading label="Counting missed games" />;
  const worst = [...rows].sort((a, b) => a.luck - b.luck).slice(0, 15);
  const best = [...rows].sort((a, b) => b.luck - a.luck).slice(0, 5);

  return (
    <div className="nba-grid">
      <div className="nba-injury-main">
        <section className="nba-panel" aria-label="Unluckiest seasons">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Unluckiest seasons</h3>
          </div>
          <SeasonRows rows={worst} />
        </section>
        <section className="nba-panel" aria-label="Luckiest seasons">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Luckiest seasons</h3>
          </div>
          <SeasonRows rows={best} />
        </section>
      </div>
      <div>
        <section className="nba-panel" aria-label="Career injury luck">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Career luck</h3>
          </div>
          <div className="nba-metric-heading nba-metric-heading-panel">Pts a season vs expected</div>
          <ul className="nba-rows">
            {careers.map((c) => (
              <li key={c.owner} className="nba-row">
                <span className="nba-row-main">
                  <span className="nba-row-title">
                    <Link to={`/nba/managers/${slugify(c.owner)}`}>{c.owner}</Link>
                  </span>
                  <span className="nba-row-sub">
                    {c.seasons} {c.seasons === 1 ? 'season' : 'seasons'} · {c.lost} games lost · {pct(c.keptIn, c.lost)} kept in
                  </span>
                </span>
                <RowValue value={c.luck / c.seasons} sign />
              </li>
            ))}
          </ul>
        </section>
        <p className="nba-foot">
          Luck is points lost to surprise absences against what each starter’s history predicted, season by
          season. Games a manager kept an already-injured player in the lineup don’t count toward it.
        </p>
      </div>
    </div>
  );
}

function SeasonRows({
  rows,
}: {
  rows: (TeamInjuries & { season: number; owner: string; teamName: string })[];
}) {
  return (
    <ul className="nba-rows">
      {rows.map((r) => (
        <li key={`${r.season}-${r.id}`} className="nba-row">
          <span className="nba-row-main">
            <span className="nba-row-title">
              {r.owner} <span className="nba-faint">{seasonLabel(r.season)}</span>
            </span>
            <span className="nba-row-sub">
              {r.lost} games lost, {r.points.toFixed(1)} pts · {r.keptIn} kept in · finished {ordinal(r.rank)}
              {r.healthyRank !== r.rank && `, healthy ${ordinal(r.healthyRank)}`}
            </span>
          </span>
          <RowValue value={r.luck} sign label="vs expected" />
        </li>
      ))}
    </ul>
  );
}
