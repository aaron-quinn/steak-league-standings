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
  positionGroup,
  slotComparisons,
  type Acquired,
  type RosterModel,
  type RosterPlayer,
  type SlotComparison,
  type TeamStrength,
  type ValueBasis,
} from '../lib/rosters';
import { dateOfDay, shortDate } from '../lib/season';
import { hasStarted, lastName, personName } from '../lib/standings';
import { useRosters } from '../lib/useRosters';

type Basis = ValueBasis;
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
function SortHeader<K extends string | number>({
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
      </button>
    </th>
  );
}

function useSort<K extends string | number>(initial: K) {
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
        Projections may lag injury news.
        <b>Finish</b> adds today’s totals; <b>Gap</b> is how far either sits from today’s points. Positions
        aren’t checked. Values are in roto points at last season’s rates, as on the Waivers page. Tap a team to see its
        roster.
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

type RosterSort = 'proj' | 'season' | 'value' | 'games' | 'slot' | number;

const GROUP_NAME = { G: 'guard', F: 'forward', C: 'center' } as const;
const GROUP_ORDER = { G: 0, F: 1, C: 2 } as const;

type GroupKey = 'starters' | 'bench' | 'G' | 'F' | 'C';

const GROUP_ROWS: { key: GroupKey; label: string }[] = [
  { key: 'starters', label: 'Starters' },
  { key: 'bench', label: 'Bench' },
  { key: 'G', label: 'Guards' },
  { key: 'F', label: 'Forwards' },
  { key: 'C', label: 'Centers' },
];

interface BarRow {
  id: string | number;
  label: string;
  name: string;
  delta?: number;
  rank?: number;
  teams?: number;
  title: string;
}

// A centered bar: the center is the other rosters' average for the group or
// place, so the fill grows right above it and left below.
function StrengthRows({ rows, scale, overview = false }: { rows: BarRow[]; scale: number; overview?: boolean }) {
  return (
    <div className={clsx('nba-slot-rows', { overview })}>
      {rows.map((row) => (
        <div key={row.id} className={clsx('nba-slot-row', { empty: row.delta === undefined })} title={row.title}>
          <span className="nba-slot-label">{row.label}</span>
          <span className="nba-slot-name">{row.name}</span>
          <span className="nba-slot-track" aria-hidden="true">
            {row.delta !== undefined && (
              <i
                className={clsx('nba-slot-fill', row.delta >= 0 ? 'pos' : 'neg')}
                style={{ width: `${(Math.abs(row.delta) / scale) * 50}%` }}
              />
            )}
          </span>
          <span
            className={clsx('nba-slot-delta', {
              'nba-good': row.delta !== undefined && row.delta >= 0.5,
              'nba-bad': row.delta !== undefined && row.delta <= -0.5,
            })}
          >
            {row.delta === undefined ? '—' : signed(row.delta)}
            <small>{row.delta === undefined ? 'no rival' : `${ordinal(row.rank!)} of ${row.teams!}`}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function playerRows(
  players: RosterPlayer[],
  comparisons: Map<number, SlotComparison>,
  basis: Basis,
  positional = false,
): BarRow[] {
  return players.flatMap((p) => {
    const comparison = comparisons.get(p.id);
    const place = positional ? comparison?.position : comparison?.overall;
    if (!place) return [];
    const group = positional ? comparison?.position?.group : undefined;
    const delta = place.average === undefined ? undefined : value(p, basis) - place.average;
    const label = group ? `${group}${place.slot}` : `#${place.slot}`;
    const what = group ? `${ordinal(place.slot)} ${GROUP_NAME[group]}` : `${ordinal(place.slot)} on this roster`;
    const title =
      delta === undefined
        ? group
          ? `No other team has a ${ordinal(place.slot)} ${GROUP_NAME[group]}`
          : 'No other team has a player in this place'
        : `${p.name} · ${what}: ${value(p, basis).toFixed(1)} against the other rosters’ ${place.average!.toFixed(1)} average (${ordinal(place.rank!)} of ${place.teams!})`;
    return [{ id: p.id, label, name: lastName(p.name), delta, rank: place.rank, teams: place.teams, title }];
  });
}

// Starters, bench and position groups as totals, for the overview chart
function groupTotals(team: TeamStrength, basis: Basis): Record<GroupKey, number> {
  const nonIR = team.players.filter((p) => p.slot !== IR);
  const sum = (ps: RosterPlayer[]) => ps.reduce((s, p) => s + value(p, basis), 0);
  return {
    starters: sum(nonIR.filter((p) => p.starter)),
    bench: sum(nonIR.filter((p) => !p.starter)),
    G: sum(nonIR.filter((p) => positionGroup(p.position) === 'G')),
    F: sum(nonIR.filter((p) => positionGroup(p.position) === 'F')),
    C: sum(nonIR.filter((p) => positionGroup(p.position) === 'C')),
  };
}

function groupRows(team: TeamStrength, teams: TeamStrength[], basis: Basis, hasPositions: boolean) {
  const totals = new Map(teams.map((t) => [t.id, groupTotals(t, basis)]));
  const mine = totals.get(team.id)!;
  const keys = GROUP_ROWS.filter(({ key }) => hasPositions || key === 'starters' || key === 'bench');
  const rows = keys.map(({ key, label }): BarRow => {
    const all = teams.map((t) => totals.get(t.id)![key]);
    const total = mine[key];
    const average = all.length > 1 ? (all.reduce((s, v) => s + v, 0) - total) / (all.length - 1) : undefined;
    const delta = average === undefined ? undefined : total - average;
    const rank = average === undefined ? undefined : 1 + all.filter((v) => v > total + 1e-9).length;
    const title =
      average === undefined
        ? 'No other team to compare with'
        : `${label} · ${total.toFixed(1)} roto points against the other rosters’ ${average.toFixed(1)} average (${ordinal(rank!)} of ${all.length})`;
    return { id: key, label, name: `${total.toFixed(1)} pts`, delta, rank, teams: all.length, title };
  });
  const scale = Math.max(1, ...rows.map((row) => (row.delta === undefined ? 0 : Math.abs(row.delta))));
  return { rows, scale };
}

function SlotStrength({
  team,
  teams,
  comparisons,
  basis,
  hasPositions,
}: {
  team: TeamStrength;
  teams: TeamStrength[];
  comparisons: Map<number, SlotComparison>;
  basis: Basis;
  hasPositions: boolean;
}) {
  const roster = team.players.filter((p) => p.slot !== IR && comparisons.has(p.id));
  const overall = [...roster].sort((a, b) => comparisons.get(a.id)!.overall.slot - comparisons.get(b.id)!.overall.slot);
  const positional = roster
    .filter((p) => comparisons.get(p.id)?.position)
    .sort((a, b) => {
      const pa = comparisons.get(a.id)!.position!;
      const pb = comparisons.get(b.id)!.position!;
      return GROUP_ORDER[pa.group] - GROUP_ORDER[pb.group] || pa.slot - pb.slot;
    });
  const deltas = [...overall, ...positional].flatMap((p) => {
    const comparison = comparisons.get(p.id)!;
    return [comparison.overall, comparison.position]
      .filter((place) => place?.average !== undefined)
      .map((place) => Math.abs(value(p, basis) - place!.average!));
  });
  const scale = Math.max(1, ...deltas);
  const overview = groupRows(team, teams, basis, hasPositions);

  return (
    <section className="nba-slot-strength" aria-label="Strength against the league">
      <div className="nba-slot-head">
        <h4 className="nba-slot-title">Against the league</h4>
        <span className="nba-slot-sub">Bars start at the other rosters’ average for the same group or place; IR left out.</span>
      </div>
      <div className="nba-slot-overview">
        <h5>Overview</h5>
        <StrengthRows rows={overview.rows} scale={overview.scale} overview />
      </div>
      <div className={clsx('nba-slot-grid', { one: !hasPositions })}>
        <div className="nba-slot-chart">
          <h5>By slot</h5>
          <StrengthRows rows={playerRows(overall, comparisons, basis)} scale={scale} />
        </div>
        {hasPositions && (
          <div className="nba-slot-chart">
            <h5>By position</h5>
            <StrengthRows rows={playerRows(positional, comparisons, basis, true)} scale={scale} />
          </div>
        )}
      </div>
    </section>
  );
}

function RosterCard({ league, model, team, basis }: { league: NbaLeague; model: RosterModel; team: TeamStrength; basis: Basis }) {
  const cats = useCategoryCells(model, basis);
  const comparisons = useMemo(() => slotComparisons(model.teams, basis), [model, basis]);
  const hasPositions = useMemo(() => model.teams.some((t) => t.players.some((p) => p.position)), [model]);
  const [sort, onSort] = useSort<RosterSort>('value');
  const rankKey = (p: RosterPlayer): number => {
    const current = sort.key;
    if (current === 'proj') return -p.projectedRank;
    if (current === 'season') return p.seasonRank ? -p.seasonRank : -Infinity;
    if (current === 'value') return value(p, basis);
    if (current === 'games') return p.games;
    if (current === 'slot') return -(comparisons.get(p.id)?.overall.slot ?? Infinity);
    return cats.cells.get(p.id)?.values[current] ?? -Infinity;
  };
  const groups: { label: string; players: RosterPlayer[] }[] = [
    { label: `Projected ${model.starters}`, players: team.players.filter((p) => p.starter) },
    { label: 'Bench', players: team.players.filter((p) => !p.starter && p.slot !== IR) },
    { label: 'IR', players: team.players.filter((p) => p.slot === IR) },
  ]
    .filter((g) => g.players.length)
    .map((g) => ({
      ...g,
      players: [...g.players].sort((a, b) => (sort.desc ? 1 : -1) * (rankKey(b) - rankKey(a))),
    }));
  const colCount = 7 + CATEGORIES.length;

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
              <SortHeader label="Proj" column="proj" sort={sort} onSort={onSort} title="Rank among rostered players by rest-of-season value" />
              <SortHeader label="Season" column="season" sort={sort} onSort={onSort} title="Rank among rostered players by value so far this season" />
              <SortHeader
                label="Value"
                column="value"
                sort={sort}
                onSort={onSort}
                title={basis === 'projected' ? 'Roto points projected from here on' : 'Roto points produced so far'}
              />
              <SortHeader
                label="Slot"
                column="slot"
                sort={sort}
                onSort={onSort}
                title="This roster’s best player, second-best and so on, bench included and IR left out"
              />
              {CATEGORIES.map((c, i) => (
                <SortHeader key={c.key} label={c.label} column={i} sort={sort} onSort={onSort} className="cat" title={`Sort by ${c.label}`} />
              ))}
              <SortHeader label="G" column="games" sort={sort} onSort={onSort} title="NBA games played this season" />
              <th scope="col" style={{ textAlign: 'left' }}>Cost</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.label}>
              <tr className="nba-roster-group">
                <th colSpan={colCount} scope="colgroup">{g.label}</th>
              </tr>
              {g.players.map((p) => {
                const cost = acquiredLabel(p.acquired, league);
                const comparison = comparisons.get(p.id);
                const place = comparison?.overall;
                const pos = comparison?.position;
                return (
                  <tr key={p.id}>
                    <td className="player">
                      <PlayerName name={p.name} proTeam={p.proTeam} />
                      {p.position && (
                        <span className="nba-roster-tag pos" title={`ESPN position: ${p.position}`}>
                          {p.position}
                        </span>
                      )}
                      <SlotTag p={p} />
                    </td>
                    <td className={clsx('num', { lead: basis === 'projected' })}>{p.projectedRank}</td>
                    <td className={clsx('num', { lead: basis === 'season' })}>{p.seasonRank || '—'}</td>
                    <td className="num value">{value(p, basis).toFixed(1)}</td>
                    <td
                      className="num slot"
                      title={
                        place
                          ? `${ordinal(place.slot)} on this roster${pos ? `, ${ordinal(pos.slot)} ${GROUP_NAME[pos.group]}` : ''}`
                          : 'IR doesn’t count toward roster slots'
                      }
                    >
                      {place ? (
                        <>
                          <b>#{place.slot}</b>
                          {pos && <small>{pos.group}{pos.slot}</small>}
                        </>
                      ) : (
                        <span className="nba-faint">—</span>
                      )}
                    </td>
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
      <SlotStrength team={team} teams={model.teams} comparisons={comparisons} basis={basis} hasPositions={hasPositions} />
      <p className="nba-foot nba-panel-foot">
        Category cells are per game ({basis === 'projected' ? 'the blended line the projection uses' : 'this season'}),
        shaded against every rostered player; FG% and FT% shade by their effect, so volume counts. <b>Slot</b> ranks this
        roster by value, IR left out and the bench included. Under the table, the overview compares the starters, bench
        and each position group with the same group on the other rosters; the detail charts compare each player with the
        same place. Bars run from that average, and the small number is the rank against the rest of the league. All of
        them follow the Projected/Season toggle. Injury tags come from ESPN. <b>Missed</b> counts consecutive NBA team
        games missed. Tap a column to sort.
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
          ? 'Projected value is roto points from here on: the per-game line blended with the last two seasons, times expected games remaining. Availability uses a RotoWire snapshot for up to 48 hours, then ESPN, then historical availability. Projections may lag injury news.'
          : 'Season value is roto points produced so far, in every NBA game, rostered or not.'}{' '}
        Values are at last season’s rates. Tap a category to sort by it.
      </p>
    </section>
  );
}
