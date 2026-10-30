import clsx from 'clsx';
import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PlayerName from '../components/PlayerName';
import { signed } from '../components/RowValue';
import SeasonStatus from '../components/SeasonStatus';
import Shell, { Loading } from '../components/Shell';
import type { NbaLeague } from '../lib/data';
import { formatPoints, ordinal } from '../lib/format';
import { slugify } from '../lib/people';
import { CATEGORIES } from '../lib/roto';
import {
  perGameCategories,
  perGameLine,
  type Acquired,
  type RosterModel,
  type RosterPlayer,
  type TeamStrength,
} from '../lib/rosters';
import { dateOfDay, shortDate } from '../lib/season';
import { hasStarted, lastName, personName } from '../lib/standings';
import { useRosters } from '../lib/useRosters';

type Basis = 'projected' | 'season';
type View = 'teams' | 'players';

const IR = 13;
const BENCH = 12;

// ?view=players, ?rank=season, ?team= and ?with=, so a view survives a reload
// or a shared link
function useParam(key: string): [string | null, (value: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const set = (value: string | null) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );
  return [params.get(key), set];
}

export default function RostersPage() {
  const [viewParam, setView] = useParam('view');
  const [rankParam, setRank] = useParam('rank');
  const view: View = viewParam === 'players' ? 'players' : 'teams';
  const basis: Basis = rankParam === 'season' ? 'season' : 'projected';
  const { league, model, isError, freshness } = useRosters();

  return (
    <Shell
      title="Rosters"
      status={league ? <SeasonStatus league={league} /> : null}
      tools={
        <div className="nba-tools">
          <div className="nba-seg" role="group" aria-label="Teams or players">
            <button aria-pressed={view === 'teams'} onClick={() => setView(null)}>
              Teams
            </button>
            <button aria-pressed={view === 'players'} onClick={() => setView('players')}>
              Players
            </button>
          </div>
          <div className="nba-seg" role="group" aria-label="Rank players by">
            <button
              aria-pressed={basis === 'projected'}
              onClick={() => setRank(null)}
              title="Rest-of-season value: per-game line blended with the last two seasons, times games left"
            >
              Projected
            </button>
            <button
              aria-pressed={basis === 'season'}
              onClick={() => setRank('season')}
              title="Value produced so far this season"
            >
              Season
            </button>
          </div>
        </div>
      }
    >
      <p className="nba-foot" role="status">{freshness}</p>
      {league && !hasStarted(league) ? (
        <div className="nba-panel">
          <div className="nba-empty">
            <b>No games yet</b>Rosters are valued once the season tips off.
          </div>
        </div>
      ) : isError ? (
        <div className="nba-panel">
          <div className="nba-empty">
            <b>Couldn’t load rosters</b>ESPN didn’t answer. Try again in a minute.
          </div>
        </div>
      ) : !league || !model ? (
        <Loading label="Valuing rosters" />
      ) : view === 'players' ? (
        <PlayersView league={league} model={model} basis={basis} />
      ) : (
        <TeamsView league={league} model={model} basis={basis} />
      )}
    </Shell>
  );
}

// Cyan above the middle, pink below, stronger toward either end (as on the
// player pages)
function heat(p: number) {
  const strength = Math.round(Math.abs(p - 0.5) * 2 * 48);
  const color = p >= 0.5 ? 'var(--cyan)' : 'var(--bad-text)';
  return `color-mix(in srgb, ${color} ${strength}%, transparent)`;
}

// Share of values below v, ties counting half
function percentile(sorted: number[], v: number) {
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return sorted.length ? (below + equal / 2) / sorted.length : 0.5;
}

// Every rostered player's per-game line and its value in each category, and
// each category's values sorted for the heat
function useCategoryCells(model: RosterModel, basis: Basis) {
  return useMemo(() => {
    const cells = new Map<number, { line: number[]; values: number[] }>();
    for (const p of model.players) {
      const line = perGameLine(p, basis);
      if (line) cells.set(p.id, { line, values: perGameCategories(line, model.rates) });
    }
    const sorted = CATEGORIES.map((_, i) => [...cells.values()].map((c) => c.values[i]).sort((a, b) => a - b));
    return { cells, sorted };
  }, [model, basis]);
}

const value = (p: RosterPlayer, basis: Basis) => (basis === 'projected' ? p.projectedValue : p.seasonValue);
const rankOf = (p: RosterPlayer, basis: Basis) => (basis === 'projected' ? p.projectedRank : p.seasonRank);

function CategoryCells({ id, cats }: { id: number; cats: ReturnType<typeof useCategoryCells> }) {
  const cell = cats.cells.get(id);
  return (
    <>
      {CATEGORIES.map((c, i) => {
        if (!cell) return <td key={c.key} className="cat">—</td>;
        const p = percentile(cats.sorted[i], cell.values[i]);
        const shown =
          i < 6 ? cell.line[i].toFixed(1) : c.format(cell.line[7 + (i - 6) * 2] ? cell.line[6 + (i - 6) * 2] / cell.line[7 + (i - 6) * 2] : 0);
        return (
          <td
            key={c.key}
            className="cat"
            style={{ '--heat': heat(p) } as React.CSSProperties}
            title={`${c.label}: better than ${Math.round(p * 100)}% of rostered players${i >= 6 ? ', counting volume' : ''}`}
          >
            {shown}
          </td>
        );
      })}
    </>
  );
}

function acquiredLabel(a: Acquired | undefined, league: NbaLeague) {
  if (!a) return { text: '—', title: undefined };
  const on = (day: number) => shortDate(dateOfDay(league.opener, day));
  switch (a.how) {
    case 'draft':
      return { text: a.keeper ? `Keeper $${a.price}` : `$${a.price}`, title: a.keeper ? 'Kept, at this price' : 'Auction price' };
    case 'waiver':
      return { text: `Waiver $${a.bid}`, title: `Claimed ${on(a.day)}` };
    case 'free agent':
      return { text: 'Free agent', title: `Added ${on(a.day)}` };
    case 'trade':
      return { text: 'Trade', title: `Traded for ${on(a.day)}` };
  }
}

function SlotTag({ p }: { p: RosterPlayer }) {
  return (
    <>
      {p.slot === IR && <span className="nba-roster-tag" title="On injured reserve: doesn’t count">IR</span>}
      {p.slot === BENCH && <span className="nba-roster-tag" title="On the bench this week">BE</span>}
      {p.availabilitySource !== 'ESPN' && (
        <span className="nba-roster-tag" title={`${p.availabilitySource} availability: ${(p.remaining * p.availability).toFixed(1)} projected games remaining`}>
          {p.availabilitySource === 'RotoWire' ? 'RW' : p.availabilitySource}
        </span>
      )}
      {p.status && p.status !== 'ACTIVE' && (
        <span className="nba-roster-tag out" title={`ESPN injury status: ${p.status.replace(/_/g, ' ')}`}>
          {p.status === 'DAY_TO_DAY' ? 'DTD' : p.status.replace(/_/g, ' ')}
        </span>
      )}
      {p.out >= 2 && (
        <span className="nba-roster-tag out" title={`Missed his NBA team’s last ${p.out} games`}>
          Missed {p.out}
        </span>
      )}
    </>
  );
}

function Who({ league, id, short = false }: { league: NbaLeague; id: number; short?: boolean }) {
  const team = league.teams.find((t) => t.id === id);
  if (!team) return null;
  if (short) {
    return team.owner ? (
      <Link to={`/nba/managers/${slugify(team.owner)}`} title={team.owner}>
        {lastName(team.owner)}
      </Link>
    ) : (
      <span>{team.name}</span>
    );
  }
  return (
    <>
      {team.owner ? (
        <Link to={`/nba/managers/${slugify(team.owner)}`} className="who" onClick={(e) => e.stopPropagation()}>
          {team.owner}
        </Link>
      ) : (
        <span className="who">{team.name}</span>
      )}
      {team.name !== team.owner && <span className="team-name">{team.name}</span>}
    </>
  );
}

function TeamsView({ league, model, basis }: { league: NbaLeague; model: RosterModel; basis: Basis }) {
  const [teamParam, setTeam] = useParam('team');
  const rosterRef = useRef<HTMLElement>(null);
  const selected = model.teams.find((t) => t.id === Number(teamParam)) ?? model.teams[0];
  const ownerOf = (id: number) => {
    const t = league.teams.find((x) => x.id === id);
    return t ? personName(t) : '';
  };
  const select = (id: number) => {
    setTeam(id === model.teams[0].id ? null : String(id));
    rosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div className="nba-grid nba-rosters-grid">
        <div className="nba-injury-main">
          <StrengthTable league={league} model={model} selected={selected.id} onSelect={select} />
        </div>
        <CategoryStrength league={league} model={model} />
      </div>

      <StartersBench league={league} model={model} selected={selected.id} onSelect={select} />

      <section className="nba-panel nba-roster-panel" aria-label="Roster" ref={rosterRef}>
        <div className="nba-panel-head">
          <h3 className="nba-panel-title">Roster</h3>
          <label className="nba-follow">
            <span className="sr-only">Team</span>
            <select className="on" value={selected.id} onChange={(e) => setTeam(e.target.value === String(model.teams[0].id) ? null : e.target.value)}>
              {model.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {ownerOf(t.id)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <RosterCard league={league} model={model} team={selected} basis={basis} />
      </section>
    </>
  );
}

function Sparkline({ values, min, max }: { values: number[]; min: number; max: number }) {
  if (values.length < 2) return null;
  const W = 72;
  const H = 22;
  const x = (i: number) => (i / (values.length - 1)) * (W - 4) + 2;
  const y = (v: number) => H - 3 - ((v - min) / Math.max(1, max - min)) * (H - 6);
  const last = values[values.length - 1];
  const change = last - values[0];
  return (
    <svg
      className="nba-spark"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Roster strength from ${formatPoints(values[0])} to ${formatPoints(last)}`}
    >
      <title>{`${formatPoints(values[0])} → ${formatPoints(last)} (${change >= 0 ? '+' : '−'}${formatPoints(Math.abs(change))})`}</title>
      <polyline points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} />
      <circle cx={x(values.length - 1)} cy={y(last)} r={2.2} />
    </svg>
  );
}

// A table header that sorts by its column; a second click flips the order
function SortHeader<K extends string>({
  label,
  column,
  sort,
  onSort,
  title,
  className = 'num',
}: {
  label: string;
  column: K;
  sort: { key: K; desc: boolean };
  onSort: (key: K) => void;
  title?: string;
  className?: string;
}) {
  const on = sort.key === column;
  return (
    <th className={className} scope="col" title={title} aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : undefined}>
      <button className={clsx('nba-sort', { on })} onClick={() => onSort(column)}>
        {label}
        {on && <span aria-hidden="true">{sort.desc ? ' ↓' : ' ↑'}</span>}
      </button>
    </th>
  );
}

function useSort<K extends string>(initial: K) {
  const [sort, setSort] = useState<{ key: K; desc: boolean }>({ key: initial, desc: true });
  const onSort = (key: K) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
  return [sort, onSort] as const;
}

type StrengthKey = 'roster' | 'today' | 'finish' | 'gap';
type GapTo = 'finish' | 'roster';

function StrengthTable({
  league,
  model,
  selected,
  onSelect,
}: {
  league: NbaLeague;
  model: RosterModel;
  selected: number;
  onSelect: (id: number) => void;
}) {
  const [sort, onSort] = useSort<StrengthKey>('roster');
  const [gapParam, setGapTo] = useParam('gap');
  const gapTo: GapTo = gapParam === 'roster' ? 'roster' : 'finish';
  const all = model.teams.flatMap((t) => t.trend);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const gap = (t: TeamStrength) => (gapTo === 'finish' ? t.finish.points : t.roster.points) - t.now.points;
  const key: Record<StrengthKey, (t: TeamStrength) => number> = {
    roster: (t) => t.roster.points,
    today: (t) => t.now.points,
    finish: (t) => t.finish.points,
    gap,
  };
  const rows = [...model.teams].sort((a, b) => (sort.desc ? 1 : -1) * (key[sort.key](b) - key[sort.key](a)));

  return (
    <section className="nba-panel" aria-label="Roster strength">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Roster strength</h3>
        <div className="nba-seg" role="group" aria-label="Gap from today to">
          <button aria-pressed={gapTo === 'finish'} onClick={() => setGapTo(null)} title="Gap: projected finish minus today’s points">
            Gap to finish
          </button>
          <button aria-pressed={gapTo === 'roster'} onClick={() => setGapTo('roster')} title="Gap: roster strength minus today’s points">
            Gap to roster
          </button>
        </div>
      </div>
      <div className="nba-scroll">
        <table className="nba-table nba-injury-table nba-strength-table">
          <thead>
            <tr>
              <th className="rank" scope="col">#</th>
              <th className="team-cell" scope="col" style={{ textAlign: 'left' }}>Manager</th>
              <SortHeader label="Roster" column="roster" sort={sort} onSort={onSort} title="Roto points the projected nine would score from here on, against every other team’s nine" />
              <SortHeader label="Today" column="today" sort={sort} onSort={onSort} title="The standings today" />
              <SortHeader label="Finish" column="finish" sort={sort} onSort={onSort} title="Today’s totals plus each projected nine’s rest of the season" />
              <SortHeader
                label="Gap"
                column="gap"
                sort={sort}
                onSort={onSort}
                title={gapTo === 'finish' ? 'Projected finish points minus today’s' : 'Roster strength points minus today’s'}
              />
              <th scope="col" title="Roster strength each day: that day’s roster, every player at today’s projection">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const g = gap(t);
              return (
                <tr key={t.id} className={clsx('openable', { selected: t.id === selected })} onClick={() => onSelect(t.id)}>
                  <td className="rank">{i + 1}</td>
                  <td className="team-cell">
                    <Who league={league} id={t.id} />
                  </td>
                  <td className="num">
                    <b className="strength">{formatPoints(t.roster.points)}</b>
                    <small>{ordinal(t.roster.rank)}</small>
                  </td>
                  <td className="num">
                    <b>{formatPoints(t.now.points)}</b>
                    <small>{ordinal(t.now.rank)}</small>
                  </td>
                  <td className="num">
                    <b>{formatPoints(t.finish.points)}</b>
                    <small>{ordinal(t.finish.rank)}</small>
                  </td>
                  <td className={clsx('num gap', { 'nba-good': g >= 0.5, 'nba-bad': g <= -0.5 })}>
                    {g > 0 ? '+' : g < 0 ? '−' : ''}
                    {formatPoints(Math.abs(g))}
                  </td>
                  <td className="trend">
                    <Sparkline values={t.trend} min={min} max={max} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="nba-foot nba-panel-foot">
        <b>Roster</b> runs each team’s best nine (a week’s starters, IR left out) through the roto standings for the rest
        of the season, with no head start. Each player projects at his per-game line blended with his last two seasons
        (rookies with a typical end-of-roster line), times projected games remaining, capped at his NBA team’s
        games left. Availability uses a RotoWire snapshot for up to 48 hours, then ESPN, then historical availability.
        Player tags identify the source; projections may lag injury news.
        <b>Finish</b> adds today’s totals; <b>Gap</b> is how far either sits from today’s points. Positions
        aren’t checked. Values are in roto points at last season’s rates, as on the Waivers page. Tap a team to see its
        roster.
      </p>
    </section>
  );
}

type DepthKey = 'starters' | 'bench' | 'lineup';

// Each roster as a bar of its players' projected values, the best nine first,
// with what's behind them: depth, and how this week's lineup compares
function StartersBench({
  league,
  model,
  selected,
  onSelect,
}: {
  league: NbaLeague;
  model: RosterModel;
  selected: number;
  onSelect: (id: number) => void;
}) {
  const [sort, onSort] = useSort<DepthKey>('starters');
  const rankBy = (f: (t: TeamStrength) => number) => {
    const order = [...model.teams].sort((a, b) => f(b) - f(a));
    return new Map(order.map((t, i) => [t.id, i + 1]));
  };
  const starterRank = rankBy((t) => t.starters);
  const benchRank = rankBy((t) => t.bench);
  const left = (t: TeamStrength) => t.lineup - t.available;
  const key: Record<DepthKey, (t: TeamStrength) => number> = {
    starters: (t) => t.starters,
    bench: (t) => t.bench,
    lineup: left,
  };
  const rows = [...model.teams].sort((a, b) => (sort.desc ? 1 : -1) * (key[sort.key](b) - key[sort.key](a)));
  const widest = Math.max(...model.teams.map((t) => t.starters + t.bench + t.ir));

  return (
    <section className="nba-panel nba-depth-panel" aria-label="Starters and bench">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Starters and bench</h3>
        <span className="nba-depth-key" aria-hidden="true">
          <i className="starter" /> Best {model.starters}
          <i className="bench" /> Bench
          <i className="ir" /> IR
        </span>
      </div>
      <div className="nba-scroll">
        <table className="nba-table nba-injury-table nba-depth-table">
          <thead>
            <tr>
              <th className="rank" scope="col">#</th>
              <th className="team-cell" scope="col" style={{ textAlign: 'left' }}>Manager</th>
              <th className="shape" scope="col" style={{ textAlign: 'left' }} title="Each player’s projected value, best first">Roster</th>
              <SortHeader label={`Best ${model.starters}`} column="starters" sort={sort} onSort={onSort} title={`Projected value of the best ${model.starters}`} />
              <SortHeader label="Bench" column="bench" sort={sort} onSort={onSort} title="Projected value of everyone else, IR left out" />
              <th className="num" scope="col" title="The best player outside the best nine">Next up</th>
              <SortHeader label="Lineup" column="lineup" sort={sort} onSort={onSort} title={`This week’s lineup against the best ${model.starters} who aren’t out: value left on the bench`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const next = t.players.find((p) => !p.starter && p.slot !== IR);
              const l = left(t);
              return (
                <tr key={t.id} className={clsx('openable', { selected: t.id === selected })} onClick={() => onSelect(t.id)}>
                  <td className="rank">{i + 1}</td>
                  <td className="team-cell">
                    <Who league={league} id={t.id} />
                  </td>
                  <td className="shape">
                    <span className="nba-depth-bar">
                      {[...t.players.filter((p) => p.slot !== IR), ...t.players.filter((p) => p.slot === IR)].map((p) => (
                        <i
                          key={p.id}
                          className={p.slot === IR ? 'ir' : p.starter ? 'starter' : 'bench'}
                          style={{ width: `${(Math.max(0, p.projectedValue) / widest) * 100}%` }}
                          title={`${p.name}: ${p.projectedValue.toFixed(1)}`}
                        />
                      ))}
                    </span>
                  </td>
                  <td className="num">
                    <b>{t.starters.toFixed(1)}</b>
                    <small>{ordinal(starterRank.get(t.id)!)}</small>
                  </td>
                  <td className="num">
                    <b>{t.bench.toFixed(1)}</b>
                    <small>{ordinal(benchRank.get(t.id)!)}</small>
                  </td>
                  <td className="num">
                    {next ? (
                      <>
                        <b>{next.projectedValue.toFixed(1)}</b>
                        <small>{lastName(next.name)}</small>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={clsx('num gap', { 'nba-bad': l <= -0.5 })}>{Math.abs(l) < 0.05 ? 'Best' : signed(l)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="nba-foot nba-panel-foot">
        Values are projected roto points from here on. <b>Next up</b> is the best player outside the best{' '}
        {model.starters}, the first in when a starter goes down. <b>Lineup</b> compares this week’s starters with the
        best {model.starters} who aren’t out (ESPN lists them OUT, or two or more games missed in a row), at rest-of-season values; a player
        with few games this week can be the right one to sit even when it shows here.
      </p>
    </section>
  );
}

function CategoryStrength({ league, model }: { league: NbaLeague; model: RosterModel }) {
  const count = model.teams.length;
  return (
    <section className="nba-panel" aria-label="Roster strength by category">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">By category</h3>
      </div>
      <div className="nba-scroll">
        <table className="nba-table nba-injury-heat nba-strength-cats">
          <thead>
            <tr>
              <th className="team-cell sticky" scope="col" style={{ textAlign: 'left' }}>Manager</th>
              {CATEGORIES.map((c) => (
                <th key={c.key} scope="col">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.teams.map((t) => {
              const team = league.teams.find((x) => x.id === t.id)!;
              return (
                <tr key={t.id}>
                  <th className="team-cell sticky" scope="row">
                    <span className="who">{personName(team)}</span>
                  </th>
                  {t.roster.categories.map((c, i) => {
                    const rank = count + 1 - c.points;
                    const p = (c.points - 1) / Math.max(1, count - 1);
                    return (
                      <td
                        key={CATEGORIES[i].key}
                        style={{ '--heat': heat(p) } as React.CSSProperties}
                        title={`${CATEGORIES[i].label}: ${ordinal(Math.floor(rank))} of ${count} from here`}
                      >
                        {Math.floor(rank)}
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

function RosterCard({ league, model, team, basis }: { league: NbaLeague; model: RosterModel; team: TeamStrength; basis: Basis }) {
  const cats = useCategoryCells(model, basis);
  const groups: { label: string; players: RosterPlayer[] }[] = [
    { label: `Projected ${model.starters}`, players: team.players.filter((p) => p.starter) },
    { label: 'Bench', players: team.players.filter((p) => !p.starter && p.slot !== IR) },
    { label: 'IR', players: team.players.filter((p) => p.slot === IR) },
  ]
    .filter((g) => g.players.length)
    .map((g) => ({ ...g, players: [...g.players].sort((a, b) => value(b, basis) - value(a, basis)) }));

  return (
    <>
      <div className="nba-roster-summary">
        <span>
          <b>{ordinal(team.roster.rank)}</b> roster · {formatPoints(team.roster.points)} pts
        </span>
        <span>
          Starters <b>{team.starters.toFixed(1)}</b>
        </span>
        <span>
          Bench <b>{team.bench.toFixed(1)}</b>
        </span>
        {team.ir > 0 && (
          <span>
            IR <b>{team.ir.toFixed(1)}</b>
          </span>
        )}
      </div>
      <div className="nba-scroll">
        <table className="nba-table nba-cats nba-roster-table">
          <thead>
            <tr>
              <th className="player" scope="col" style={{ textAlign: 'left' }}>Player</th>
              <th className="num" scope="col" title="Rank among rostered players by rest-of-season value">Proj</th>
              <th className="num" scope="col" title="Rank among rostered players by value so far this season">Season</th>
              <th className="num" scope="col" title={basis === 'projected' ? 'Roto points projected from here on' : 'Roto points produced so far'}>Value</th>
              {CATEGORIES.map((c) => (
                <th key={c.key} className="cat" scope="col">{c.label}</th>
              ))}
              <th className="num" scope="col" title="NBA games played this season">G</th>
              <th scope="col" style={{ textAlign: 'left' }}>Cost</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.label}>
              <tr className="nba-roster-group">
                <th colSpan={6 + CATEGORIES.length} scope="colgroup">{g.label}</th>
              </tr>
              {g.players.map((p) => {
                const cost = acquiredLabel(p.acquired, league);
                return (
                  <tr key={p.id}>
                    <td className="player">
                      <PlayerName name={p.name} proTeam={p.proTeam} />
                      <SlotTag p={p} />
                    </td>
                    <td className={clsx('num', { lead: basis === 'projected' })}>{p.projectedRank}</td>
                    <td className={clsx('num', { lead: basis === 'season' })}>{p.seasonRank || '—'}</td>
                    <td className="num value">{value(p, basis).toFixed(1)}</td>
                    <CategoryCells id={p.id} cats={cats} />
                    <td className="num nba-faint">{p.games}</td>
                    <td className="cost" title={cost.title}>{cost.text}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="nba-foot nba-panel-foot">
        Category cells are per game ({basis === 'projected' ? 'the blended line the projection uses' : 'this season'}),
        shaded against every rostered player; FG% and FT% shade by their effect, so volume counts. Injury tags
        come from ESPN. <b>Missed</b> counts consecutive NBA team games missed.
      </p>
    </>
  );
}

type PlayerSort = 'rank' | number;

function PlayersView({ league, model, basis }: { league: NbaLeague; model: RosterModel; basis: Basis }) {
  const cats = useCategoryCells(model, basis);
  const [sort, setSort] = useState<PlayerSort>('rank');
  const rows = useMemo(() => {
    const ranked = model.players.filter((p) => rankOf(p, basis) > 0);
    if (sort === 'rank') return ranked.sort((a, b) => rankOf(a, basis) - rankOf(b, basis));
    const v = (p: RosterPlayer) => cats.cells.get(p.id)?.values[sort] ?? -Infinity;
    return ranked.sort((a, b) => v(b) - v(a));
  }, [model, basis, sort, cats]);

  return (
    <section className="nba-panel" aria-label="Rostered players">
      <div className="nba-panel-head">
        <h3 className="nba-panel-title">Every rostered player</h3>
        <span className="nba-faint nba-players-sorted">
          {sort === 'rank' ? (basis === 'projected' ? 'By projected value' : 'By season value') : `By ${CATEGORIES[sort].label}`}
        </span>
      </div>
      <div className="nba-scroll">
        <table className="nba-table nba-cats nba-roster-table">
          <thead>
            <tr>
              <th className="rank" scope="col">
                <button className={clsx('nba-sort', { on: sort === 'rank' })} onClick={() => setSort('rank')}>#</button>
              </th>
              <th className="player" scope="col" style={{ textAlign: 'left' }}>Player</th>
              <th scope="col" style={{ textAlign: 'left' }}>Manager</th>
              <th className="num" scope="col" title="Rank by rest-of-season value">Proj</th>
              <th className="num" scope="col" title="Rank by value so far this season">Season</th>
              <th className="num" scope="col">Value</th>
              {CATEGORIES.map((c, i) => (
                <th key={c.key} className="cat" scope="col">
                  <button className={clsx('nba-sort', { on: sort === i })} onClick={() => setSort(i)} title={`Sort by ${c.label}`}>
                    {c.label}
                  </button>
                </th>
              ))}
              <th className="num" scope="col">G</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id}>
                <td className="rank">{i + 1}</td>
                <td className="player">
                  <PlayerName name={p.name} proTeam={p.proTeam} />
                  <SlotTag p={p} />
                </td>
                <td className="manager">
                  <Who league={league} id={p.team} short />
                </td>
                <td className={clsx('num', { lead: basis === 'projected' })}>{p.projectedRank}</td>
                <td className={clsx('num', { lead: basis === 'season' })}>{p.seasonRank || '—'}</td>
                <td className="num value">{value(p, basis).toFixed(1)}</td>
                <CategoryCells id={p.id} cats={cats} />
                <td className="num nba-faint">{p.games}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nba-foot nba-panel-foot">
        {basis === 'projected'
          ? 'Projected value is roto points from here on: the per-game line blended with the last two seasons, times expected games remaining. Availability uses a RotoWire snapshot for up to 48 hours, then ESPN, then historical availability. Player tags identify the source; projections may lag injury news.'
          : 'Season value is roto points produced so far, in every NBA game, rostered or not.'}{' '}
        Values are at last season’s rates. Tap a category to sort by it.
      </p>
    </section>
  );
}
