import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FollowPeople } from '../components/FollowSelect';
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
import {
  summarizeInjuries,
  type AbsenceScope,
  type InjurySummary,
  type PlayerAbsence,
  type PlayerInjury,
  type TeamInjuries,
} from '../lib/injuries';
import { slugify } from '../lib/people';
import { dateOfDay, isFinished, seasonLabel, shortDate } from '../lib/season';
import { lastName, personName } from '../lib/standings';
import { hasInjuries, useAllInjuries, useInjuries } from '../lib/useInjuries';

type Sort = 'luck' | 'lost' | 'lineup';
type RightMode = 'players' | 'spells';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'luck', label: 'Worst luck' },
  { value: 'lost', label: 'Most missed' },
  { value: 'lineup', label: 'In lineup' },
];

const sorters: Record<Sort, (a: TeamInjuries, b: TeamInjuries) => number> = {
  luck: (a, b) => a.luck - b.luck,
  lost: (a, b) => b.points - a.points,
  lineup: (a, b) => b.lineupPoints - a.lineupPoints || b.keptInPoints - a.keptInPoints,
};

function ScopeFilter({
  scope,
  onChange,
}: {
  scope: AbsenceScope;
  onChange: (v: AbsenceScope) => void;
}) {
  return (
    <div className="nba-seg" role="group" aria-label="Roster or starting lineup">
      <button
        aria-pressed={scope === 'roster'}
        onClick={() => onChange('roster')}
        title="Every game a team’s players missed while on the roster: starting lineup, bench and IR"
      >
        Whole roster
      </button>
      <button
        aria-pressed={scope === 'lineup'}
        onClick={() => onChange('lineup')}
        title="Only games missed while in the weekly starting lineup (IR and bench excluded)"
      >
        In lineup
      </button>
    </div>
  );
}

// All absences, or only runs of two or more games (likely injuries)
function AbsenceFilter({
  multiOnly,
  onChange,
}: {
  multiOnly: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="nba-seg" role="group" aria-label="Which absences count">
      <button
        aria-pressed={!multiOnly}
        onClick={() => onChange(false)}
        title="Every missed game"
      >
        All absences
      </button>
      <button
        aria-pressed={multiOnly}
        onClick={() => onChange(true)}
        title="Only absences of two or more games in a row"
      >
        Multi-game
      </button>
    </div>
  );
}

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');

function formatSpellRange(opener: string, from: number, to: number) {
  const start = shortDate(dateOfDay(opener, from));
  if (to === from) return start;
  return `${start}–${shortDate(dateOfDay(opener, to))}`;
}

function formatSpells(spells: PlayerAbsence[], opener: string, max = 3) {
  if (spells.length === 0) return 'No games missed';
  const sorted =
    spells.length <= max
      ? spells
      : [...spells].sort((a, b) => b.lost - a.lost || a.from - b.from).slice(0, max);
  const shown =
    spells.length <= max ? sorted : [...sorted].sort((a, b) => a.from - b.from);
  const parts = shown.map(
    (s) => `${formatSpellRange(opener, s.from, s.to)} (${s.lost}g)`,
  );
  const rest = spells.length - shown.length;
  return rest > 0 ? `${parts.join(' · ')} · +${rest} more` : parts.join(' · ');
}

function topMissedLabel(
  team: TeamInjuries,
  names: Record<string, string>,
  count = 3,
) {
  const list = team.players.filter((p) => p.lost > 0).slice(0, count);
  if (list.length === 0) return 'No absences';
  return list
    .map((p) => `${lastName(names[p.player] ?? `Player ${p.player}`)} ${p.lost}g`)
    .join(' · ');
}

export default function InjuriesPage() {
  const [season] = useSeason();
  const [allTime] = useAllTime();
  const [params, setParams] = useSearchParams();
  const scope: AbsenceScope = params.get('scope') === 'lineup' ? 'lineup' : 'roster';
  const [multiOnly, setMultiOnly] = useState(false);

  const setScope = (next: AbsenceScope) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'lineup') p.set('scope', 'lineup');
        else p.delete('scope');
        return p;
      },
      { replace: true },
    );

  return (
    <Shell
      title="Injuries"
      status={
        allTime ? (
          <span>Every finished season since 2018–19</span>
        ) : (
          <SeasonHeadStatus season={season} />
        )
      }
      tools={
        <div className="nba-tools">
          <ScopeFilter scope={scope} onChange={setScope} />
          <AbsenceFilter multiOnly={multiOnly} onChange={setMultiOnly} />
          {!allTime && <SeasonPicker />}
          <AllTimeToggle />
        </div>
      }
    >
      {allTime ? (
        <AllTimeView multiOnly={multiOnly} scope={scope} />
      ) : !hasInjuries(season) ? (
        <StandingsOnly season={season} what="lineups" />
      ) : (
        <SeasonView season={season} multiOnly={multiOnly} scope={scope} />
      )}
    </Shell>
  );
}

function SeasonHeadStatus({ season }: { season: number }) {
  const { league } = useInjuries(season);
  return league ? <SeasonStatus league={league} /> : null;
}

function Who({
  league,
  id,
  summary,
}: {
  league: NbaLeague;
  id: number;
  summary?: string;
}) {
  const team = league.teams.find((t) => t.id === id);
  if (!team) return null;
  return (
    <>
      {team.owner ? (
        <Link
          to={`/nba/managers/${slugify(team.owner)}`}
          className="who"
          onClick={(e) => e.stopPropagation()}
        >
          {team.owner}
        </Link>
      ) : (
        <span className="who">{team.name}</span>
      )}
      <span className="team-name">
        {summary ?? (team.name !== team.owner ? team.name : '')}
      </span>
    </>
  );
}

function SeasonView({
  season,
  multiOnly,
  scope,
}: {
  season: number;
  multiOnly: boolean;
  scope: AbsenceScope;
}) {
  const { league, data, names, proTeams, isPending } = useInjuries(season);
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState<Sort>('luck');
  const [rightMode, setRightMode] = useState<RightMode>('players');
  const [followed, setFollowed] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<number> | null>(null);

  const summary = useMemo(
    () => (league && data ? summarizeInjuries(data, league, { multiOnly, scope }) : null),
    [league, data, multiOnly, scope],
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
  const paramTeam = Number(params.get('team'));
  // Open the URL's ?team= or the top team in the table by default so the
  // player breakdown is immediately visible
  const defaultOpen = summary.teams.some((t) => t.id === paramTeam)
    ? paramTeam
    : teams[0]?.id;
  const openSet = opened ?? (defaultOpen ? new Set([defaultOpen]) : new Set<number>());

  const toggleTeam = (id: number) => {
    setOpened((prev) => {
      const next = new Set(prev ?? (defaultOpen ? [defaultOpen] : []));
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const focusTeam = (id: number) => {
    setOpened((prev) => {
      const next = new Set(prev ?? []);
      next.add(id);
      return next;
    });
    const owner = ownerOf(id);
    if (owner) setFollowed((cur) => (cur === owner ? null : owner));
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('team', String(id));
        return p;
      },
      { replace: true },
    );
  };

  const ownerOf = (id: number) => {
    const t = league.teams.find((x) => x.id === id);
    return t ? personName(t) : '';
  };
  const worst = [...summary.teams].sort(sorters.luck)[0];
  const mostLost = [...summary.teams].sort(sorters.lost)[0];
  const mostKept = [...summary.teams].sort((a, b) => b.keptInPoints - a.keptInPoints)[0];
  const swing = [...summary.teams].sort(
    (a, b) => b.rank - b.healthyRank - (a.rank - a.healthyRank),
  )[0];
  const topPlayer = summary.players[0];
  const nameOf = (id: number) => names[id] ?? `Player ${id}`;
  const live = !isFinished(season);

  const filteredPlayers = summary.players
    .filter((p) => followed === null || ownerOf(p.team) === followed)
    .slice(0, followed === null ? 20 : 40);
  const filteredSpells = summary.absences
    .filter((a) => followed === null || ownerOf(a.team) === followed)
    .slice(0, followed === null ? 20 : 40);

  return (
    <>
      <dl className="nba-facts nba-injury-facts">
        <div
          className="nba-fact clickable"
          onClick={() => focusTeam(worst.id)}
          title="Tap to see this team’s players"
        >
          <dt>Unluckiest</dt>
          <dd>
            <span className="big">{ownerOf(worst.id)}</span>
            <span className="small">
              {signed(worst.luck)} pts vs expected · {topMissedLabel(worst, names, 2)}
            </span>
          </dd>
        </div>
        {topPlayer && (
          <div
            className="nba-fact clickable"
            onClick={() => focusTeam(topPlayer.team)}
            title="Tap to see this team’s players"
          >
            <dt>Biggest absence</dt>
            <dd>
              <span className="big">{nameOf(topPlayer.player)}</span>
              <span className="small">
                {topPlayer.lost} games ({topPlayer.points.toFixed(1)} pts) for{' '}
                {ownerOf(topPlayer.team)}
              </span>
            </dd>
          </div>
        )}
        {swing.rank !== swing.healthyRank && (
          <div
            className="nba-fact clickable"
            onClick={() => focusTeam(swing.id)}
            title="Tap to see this team’s players"
          >
            <dt>Healthy, would be</dt>
            <dd>
              <span className="big">
                {ownerOf(swing.id)} {ordinal(swing.healthyRank)}
              </span>
              <span className="small">
                not {ordinal(swing.rank)} · {topMissedLabel(swing, names, 2)}
              </span>
            </dd>
          </div>
        )}
        {scope === 'lineup' && mostKept.keptIn > 0 ? (
          <div
            className="nba-fact clickable"
            onClick={() => focusTeam(mostKept.id)}
            title="Tap to see this team’s players"
          >
            <dt>Kept the injured in</dt>
            <dd>
              <span className="big">{ownerOf(mostKept.id)}</span>
              <span className="small">
                {mostKept.keptIn} games, {mostKept.keptInPoints.toFixed(1)} pts
              </span>
            </dd>
          </div>
        ) : (
          <div
            className="nba-fact clickable"
            onClick={() => focusTeam(mostLost.id)}
            title="Tap to see this team’s players"
          >
            <dt>Most missed</dt>
            <dd>
              <span className="big">{ownerOf(mostLost.id)}</span>
              <span className="small">
                {mostLost.points.toFixed(1)} pts across {mostLost.lost} games (
                {mostLost.lineup} lineup, {mostLost.sidelined} IR/B)
              </span>
            </dd>
          </div>
        )}
      </dl>

      <div className="nba-grid">
        <div className="nba-injury-main">
          <section className="nba-panel" aria-label="Injury luck by team">
            <div className="nba-panel-head" style={{ flexWrap: 'wrap' }}>
              <h3 className="nba-panel-title">By team</h3>
              <div className="nba-seg" role="group" aria-label="Sort teams">
                {SORTS.map((s) => (
                  <button
                    key={s.value}
                    aria-pressed={sort === s.value}
                    onClick={() => setSort(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="nba-metric-note">
              {scope === 'roster' ? (
                <>
                  Every game a team’s players missed while on the roster — in the{' '}
                  <b>starting lineup</b> or sidelined on <b>IR / bench</b> — valued at each
                  player’s per-game roto line (<b>Pts/G</b>). <b>Expected</b> is what each
                  player’s prior two seasons predicted he’d miss;{' '}
                  <b>Luck = Expected − Pts missed</b>. Tap any team to see its player-by-player
                  breakdown.
                </>
              ) : (
                <>
                  Games missed in an active weekly <b>starting slot</b> only (IR and bench
                  excluded). <b>Kept in</b> games were already out when Monday’s lineup locked;{' '}
                  <b>Luck</b> compares mid-week surprise losses with what each starter’s prior two
                  seasons predicted. Tap any team to see its players.
                </>
              )}
            </p>
            <div className="nba-scroll">
              <table className="nba-table nba-injury-table">
                <thead>
                  <tr>
                    <th className="rank" scope="col">
                      #
                    </th>
                    <th className="team-cell" scope="col" style={{ textAlign: 'left' }}>
                      Manager &amp; top absences
                    </th>
                    <th
                      className="num"
                      scope="col"
                      title={
                        scope === 'roster'
                          ? 'NBA games missed while on this roster: in the starting lineup (L) plus on IR or bench (IR/B)'
                          : 'Games a starter’s NBA team played without him while in the starting lineup'
                      }
                    >
                      Missed
                    </th>
                    <th
                      className="num"
                      scope="col"
                      title="Missed games valued in roto points, at each player’s per-game stat line"
                    >
                      Pts missed
                    </th>
                    {scope === 'lineup' ? (
                      <th
                        className="num"
                        scope="col"
                        title="Games lost while the player was already out when the week’s lineup locked"
                      >
                        Kept in
                      </th>
                    ) : (
                      <th
                        className="num"
                        scope="col"
                        title="Games missed while in the weekly starting lineup (costing a zero in that slot) vs sidelined on IR or bench"
                      >
                        In lineup
                      </th>
                    )}
                    <th
                      className="num"
                      scope="col"
                      title="Points a league-average share of absences would have cost, given each player’s last two seasons"
                    >
                      Expected
                    </th>
                    <th
                      className="num"
                      scope="col"
                      title="Expected minus points missed (below zero is worse injury luck than the roster’s history)"
                    >
                      Luck
                    </th>
                    <th
                      className="num healthy"
                      scope="col"
                      title="Projected finish with every missed game filled in"
                    >
                      Healthy
                    </th>
                  </tr>
                </thead>
                {teams.map((t, i) => {
                  const move = t.rank - t.healthyRank;
                  const open = openSet.has(t.id);
                  return (
                    <tbody key={t.id} className="team">
                      <tr
                        className={clsx('openable', {
                          open,
                          followed: followed !== null && ownerOf(t.id) === followed,
                        })}
                        onClick={() => toggleTeam(t.id)}
                      >
                        <td className="rank">{i + 1}</td>
                        <td className="team-cell">
                          <div className="nba-injury-team-head">
                            <div className="nba-injury-team-text">
                              <Who
                                league={league}
                                id={t.id}
                                summary={topMissedLabel(t, names, 3)}
                              />
                            </div>
                            <span
                              className="nba-injury-chev"
                              aria-hidden="true"
                              title={open ? 'Hide players' : 'Show players'}
                            />
                          </div>
                        </td>
                        <td className="num">
                          <b>{t.lost}</b>
                          <small>
                            {scope === 'roster'
                              ? `${ pct(t.lost, t.starts)} of ${t.starts}`
                              : `${pct(t.lost, t.starts)} of starts`}
                          </small>
                        </td>
                        <td className="num">
                          <b>{t.points.toFixed(1)}</b>
                          <small>
                            {scope === 'roster'
                              ? `${(t.lost ? t.points / t.lost : 0).toFixed(2)}/g`
                              : `${t.surprisePoints.toFixed(1)} surprise`}
                          </small>
                        </td>
                        {scope === 'lineup' ? (
                          <td className="num">
                            <b>{t.keptIn}</b>
                            <small>{t.keptInPoints.toFixed(1)} pts</small>
                          </td>
                        ) : (
                          <td className="num">
                            <b>{t.lineupPoints.toFixed(1)}</b>
                            <small>
                              {t.lineup}L · {t.sidelined} IR/B
                            </small>
                          </td>
                        )}
                        <td className="num">
                          <b className="nba-dim">{t.expectedPoints.toFixed(1)}</b>
                          <small>{Math.round(t.expectedGames)}g exp</small>
                        </td>
                        <td
                          className={clsx('num luck', {
                            'nba-good': t.luck >= 0.05,
                            'nba-bad': t.luck <= -0.05,
                          })}
                        >
                          {signed(t.luck)}
                        </td>
                        <td className="num healthy">
                          <b>{ordinal(t.healthyRank)}</b>
                          <small
                            className={clsx({
                              'nba-good': move > 0,
                              'nba-bad': move < 0,
                            })}
                          >
                            {move === 0 ? 'same' : `was ${ordinal(t.rank)}`}
                          </small>
                        </td>
                      </tr>
                      {open && (
                        <tr className="nba-box-row">
                          <td colSpan={8}>
                            <TeamPlayersBox
                              team={t}
                              league={league}
                              names={names}
                              proTeams={proTeams}
                              scope={scope}
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
              </table>
            </div>
            <p className="nba-foot nba-panel-foot">
              A game is missed when a rostered player’s NBA team played without him: injury,
              rest or a coach’s call.{' '}
              {scope === 'roster' ? (
                <>
                  <b>Whole roster</b> counts both active lineup zeroes (<b>L</b>) and games missed
                  while moved to <b>IR or bench</b> (<b>IR/B</b>); pure $1–$4 stashes who never
                  played or started for the team are left out. <b>Healthy</b> fills in lineup
                  zeroes at the player’s per-game line and sidelined games at his upgrade over a
                  replacement starter.
                </>
              ) : (
                <>
                  <b>In lineup</b> counts only active weekly starting slots. <b>Kept in</b> games
                  are ones where the player was already out when the week’s lineup locked; the
                  rest were mid-week surprises.
                </>
              )}
              {live && ' Today’s games count from tomorrow.'}
            </p>
          </section>

          <WeekHeatmap
            summary={summary}
            league={league}
            names={names}
            order={teams.map((t) => t.id)}
          />
        </div>

        <section className="nba-panel" aria-label="Players missed most">
          <div className="nba-panel-head" style={{ flexWrap: 'wrap' }}>
            <div className="nba-seg" role="group" aria-label="View absences by">
              <button
                aria-pressed={rightMode === 'players'}
                onClick={() => setRightMode('players')}
              >
                By player
              </button>
              <button
                aria-pressed={rightMode === 'spells'}
                onClick={() => setRightMode('spells')}
              >
                By stretch
              </button>
            </div>
            <FollowPeople
              names={league.teams.map(personName)}
              value={followed}
              onChange={setFollowed}
            />
          </div>
          <div className="nba-metric-heading nba-metric-heading-panel">
            Roto points missed
          </div>
          {rightMode === 'players' ? (
            <ul className="nba-rows">
              {filteredPlayers.map((p) => (
                <li key={`${p.team}-${p.player}`} className="nba-row">
                  <span className="nba-row-main">
                    <span className="nba-row-title">
                      <PlayerName
                        name={nameOf(p.player)}
                        proTeam={proTeams[p.player]}
                      />
                      {p.price !== undefined && (
                        <span
                          className="nba-roster-tag"
                          title={`Drafted for $${p.price}`}
                        >
                          ${p.price}
                        </span>
                      )}
                    </span>
                    <span className="nba-row-sub">
                      {ownerOf(p.team)} · <b>{p.lost} missed</b> (
                      {scope === 'roster'
                        ? `${p.lineup} lineup, ${p.sidelined} IR/B`
                        : `${p.surprise} surprise${p.keptIn ? `, ${p.keptIn} kept in` : ''}`}
                      ) · {p.played} played · {p.perGame.toFixed(2)} pts/g
                    </span>
                    <span className="nba-row-sub nba-faint">
                      {formatSpells(p.spells, league.opener, 2)}
                    </span>
                  </span>
                  <RowValue
                    value={p.points}
                    label={`${signed(p.luck)} luck`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="nba-rows">
              {filteredSpells.map((a) => (
                <li key={`${a.team}-${a.player}-${a.from}`} className="nba-row">
                  <span className="nba-row-main">
                    <span className="nba-row-title">
                      <PlayerName
                        name={nameOf(a.player)}
                        proTeam={proTeams[a.player]}
                      />
                    </span>
                    <span className="nba-row-sub">
                      {ownerOf(a.team)} ·{' '}
                      {formatSpellRange(league.opener, a.from, a.to)}
                    </span>
                    <span className="nba-row-sub">
                      {scope === 'roster' ? (
                        <>
                          {a.lost} missed ({a.lineup} lineup
                          {a.sidelined > 0 && `, ${a.sidelined} IR/B`})
                        </>
                      ) : (
                        <>
                          {a.lost} in the lineup
                          {a.length > a.lost && ` of ${a.length} missed`}
                          {a.keptIn > 0 && ` · ${a.keptIn} kept in`}
                        </>
                      )}
                    </span>
                  </span>
                  <RowValue value={a.points} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function TeamPlayersBox({
  team,
  league,
  names,
  proTeams,
  scope,
}: {
  team: TeamInjuries;
  league: NbaLeague;
  names: Record<string, string>;
  proTeams: Record<string, number>;
  scope: AbsenceScope;
}) {
  const [showAll, setShowAll] = useState(false);
  const nameOf = (id: number) => names[id] ?? `Player ${id}`;
  const withMisses = team.players.filter((p) => p.lost > 0);
  const healthyPlayers = team.players.filter((p) => p.lost === 0);
  const INITIAL_LIMIT = 10;
  const shown = showAll ? team.players : withMisses.slice(0, INITIAL_LIMIT);
  const hidden = showAll
    ? []
    : [...withMisses.slice(INITIAL_LIMIT), ...healthyPlayers];

  const hiddenSummary = useMemo(() => {
    if (hidden.length === 0) return null;
    return hidden.reduce(
      (acc, p) => {
        acc.played += p.played;
        acc.lost += p.lost;
        acc.lineup += p.lineup;
        acc.sidelined += p.sidelined;
        acc.points += p.points;
        acc.expectedGames += p.expectedGames;
        acc.expectedPoints += p.expectedPoints;
        acc.luck += p.luck;
        return acc;
      },
      {
        played: 0,
        lost: 0,
        lineup: 0,
        sidelined: 0,
        points: 0,
        expectedGames: 0,
        expectedPoints: 0,
        luck: 0,
      },
    );
  }, [hidden]);

  return (
    <div className="nba-box nba-injury-box">
      <table>
        <caption className="sr-only">
          Players on this roster and the games and roto points they missed
        </caption>
        <thead>
          <tr>
            <th scope="col" className="player">
              Player &amp; absences
            </th>
            <th
              scope="col"
              title="Games played vs games missed while on this team (cyan = played, pink = missed in starting lineup, violet = missed on IR or bench)"
            >
              Games on roster
            </th>
            <th
              scope="col"
              title="Roto points one game from this player is worth, from his per-game stat line"
            >
              Pts/G
            </th>
            <th scope="col" title="Missed games times Pts/G">
              Pts missed
            </th>
            <th
              scope="col"
              title="Expected points missed from his prior two seasons’ miss rate, scaled to this season"
            >
              Expected
            </th>
            <th
              scope="col"
              title="Expected minus points missed: below zero means he missed more than his history predicted"
            >
              Luck
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <PlayerBreakdownRow
              key={p.player}
              p={p}
              name={nameOf(p.player)}
              proTeam={proTeams[p.player]}
              opener={league.opener}
              scope={scope}
            />
          ))}
          {hiddenSummary && (
            <tr
              className="nba-injury-more-row"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(true);
              }}
              title="Tap to show every player on this team, including healthy starters"
            >
              <th scope="row" className="player">
                <button
                  type="button"
                  className="nba-link"
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAll(true);
                  }}
                >
                  +{hidden.length} healthier{' '}
                  {hidden.length === 1 ? 'player' : 'players'}
                </button>
                <span className="when">
                  {hidden
                    .slice(0, 4)
                    .map((p) => `${lastName(nameOf(p.player))} (${p.played}g played)`)
                    .join(' · ')}
                  {hidden.length > 4 && ` · +${hidden.length - 4} more`}
                </span>
              </th>
              <td>
                <b>
                  {hiddenSummary.lost} missed · {hiddenSummary.played} played
                </b>
              </td>
              <td className="min">–</td>
              <td>{hiddenSummary.points.toFixed(1)}</td>
              <td className="min">
                {hiddenSummary.expectedPoints.toFixed(1)}
                <span className="nba-injury-cell-sub">
                  {Math.round(hiddenSummary.expectedGames)}g exp
                </span>
              </td>
              <td
                className={clsx({
                  'nba-good': hiddenSummary.luck >= 0.05,
                  'nba-bad': hiddenSummary.luck <= -0.05,
                })}
              >
                <b>{signed(hiddenSummary.luck)}</b>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="player">
              Team total ({team.players.length} players)
              {showAll && hidden.length === 0 && team.players.length > INITIAL_LIMIT && (
                <button
                  type="button"
                  className="nba-link"
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 0,
                    marginLeft: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAll(false);
                  }}
                >
                  Collapse healthy
                </button>
              )}
            </th>
            <td>
              {team.lost} missed ({scope === 'roster' ? `${team.lineup}L, ${team.sidelined} IR/B` : `${team.surprise} surprise`}) · {team.played} played
            </td>
            <td>{(team.lost ? team.points / team.lost : 0).toFixed(2)}/g</td>
            <td>{team.points.toFixed(1)}</td>
            <td>{team.expectedPoints.toFixed(1)}</td>
            <td
              className={clsx({
                'nba-good': team.luck >= 0.05,
                'nba-bad': team.luck <= -0.05,
              })}
            >
              {signed(team.luck)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PlayerBreakdownRow({
  p,
  name,
  proTeam,
  opener,
  scope,
}: {
  p: PlayerInjury;
  name: string;
  proTeam?: number;
  opener: string;
  scope: AbsenceScope;
}) {
  const total = Math.max(1, p.played + p.lost);
  const playedPct = (p.played / total) * 100;
  const lineupPct = (p.lineup / total) * 100;
  const sidelinedPct = (p.sidelined / total) * 100;

  return (
    <tr>
      <th scope="row" className="player">
        <div className="nba-injury-player-line">
          <PlayerName name={name} proTeam={proTeam} />
          {p.price !== undefined && (
            <span className="nba-roster-tag" title={`Drafted for $${p.price}`}>
              ${p.price}
            </span>
          )}
        </div>
        <span className="when">{formatSpells(p.spells, opener, 3)}</span>
      </th>
      <td>
        <div className="nba-injury-games-cell">
          <span
            className="nba-injury-split-bar"
            title={`${p.played} played, ${p.lineup} missed in starting lineup${scope === 'roster' ? `, ${p.sidelined} missed on IR/bench (${p.ir} IR, ${p.bench} bench)` : ''}`}
          >
            {p.played > 0 && (
              <span className="seg-played" style={{ width: `${playedPct}%` }} />
            )}
            {p.lineup > 0 && (
              <span className="seg-lineup" style={{ width: `${lineupPct}%` }} />
            )}
            {scope === 'roster' && p.sidelined > 0 && (
              <span className="seg-sidelined" style={{ width: `${sidelinedPct}%` }} />
            )}
          </span>
          <span className="nba-injury-games-nums">
            <b>{p.lost} missed</b> · {p.played} played
          </span>
          <span className="nba-injury-cell-sub">
            {scope === 'roster' ? (
              <>
                {p.lineup} lineup
                {p.sidelined > 0 && ` · ${p.sidelined} IR/B`}
                {p.keptIn > 0 && ` (${p.keptIn} kept in)`}
              </>
            ) : (
              <>
                {p.surprise} surprise
                {p.keptIn > 0 && ` · ${p.keptIn} kept in`}
              </>
            )}
          </span>
        </div>
      </td>
      <td className="min">{p.perGame.toFixed(2)}</td>
      <td>
        <b>{p.points.toFixed(1)}</b>
        {scope === 'roster' && p.lineupPoints > 0 && p.sidelinedPoints > 0 && (
          <span className="nba-injury-cell-sub">
            {p.lineupPoints.toFixed(1)}L · {p.sidelinedPoints.toFixed(1)} IR/B
          </span>
        )}
      </td>
      <td className="min">
        {p.expectedPoints.toFixed(1)}
        <span className="nba-injury-cell-sub">
          {Math.round(p.usualRate * 100)}% usual ({p.expectedGames.toFixed(1)}g)
        </span>
      </td>
      <td
        className={clsx({
          'nba-good': p.luck >= 0.05,
          'nba-bad': p.luck <= -0.05,
        })}
      >
        <b>{signed(p.luck)}</b>
      </td>
    </tr>
  );
}

function WeekHeatmap({
  summary,
  league,
  names,
  order,
}: {
  summary: InjurySummary;
  league: NbaLeague;
  names: Record<string, string>;
  order: number[];
}) {
  const byId = new Map(summary.teams.map((t) => [t.id, t]));
  const max = Math.max(1, ...summary.teams.flatMap((t) => t.weeks.map((w) => w.games)));
  const nameOf = (id: number) => names[id] ?? `Player ${id}`;

  // Default to the single heaviest team-week of the season so the readout
  // bar immediately shows an example
  const heaviest = useMemo(() => {
    let best: { teamId: number; weekIdx: number; games: number } | null = null;
    for (const id of order) {
      const t = byId.get(id);
      if (!t) continue;
      t.weeks.forEach((w, i) => {
        if (w.games > (best?.games ?? 0)) {
          best = { teamId: id, weekIdx: i, games: w.games };
        }
      });
    }
    return best;
  }, [order, byId]);

  const [selected, setSelected] = useState<{ teamId: number; weekIdx: number } | null>(
    null,
  );
  const active = selected ?? heaviest;
  const activeTeam = active ? byId.get(active.teamId) : undefined;
  const activeWeek = active ? summary.weeks[active.weekIdx] : undefined;
  const activeCell =
    active && activeTeam ? activeTeam.weeks[active.weekIdx] : undefined;
  const activeOwner = active
    ? personName(league.teams.find((x) => x.id === active.teamId)!)
    : '';

  return (
    <section className="nba-panel" aria-label="Games missed by week">
      <div className="nba-panel-head" style={{ flexWrap: 'wrap' }}>
        <h3 className="nba-panel-title">Games missed by week</h3>
        {active && activeWeek && activeCell && activeCell.games > 0 && (
          <span className="nba-faint" style={{ fontSize: 12.5 }}>
            Tap or hover a week cell to see who missed
          </span>
        )}
      </div>
      {active && activeWeek && activeCell && activeCell.games > 0 && (
        <div className="nba-injury-week-detail" role="status">
          <div className="nba-injury-week-head">
            <b>
              Week {activeWeek.index} (
              {shortDate(dateOfDay(league.opener, activeWeek.first))}–
              {shortDate(dateOfDay(league.opener, activeWeek.last))}) · {activeOwner}
            </b>
            <span>
              <b>{activeCell.games}</b>{' '}
              {activeCell.games === 1 ? 'game' : 'games'} missed (
              {summary.scope === 'roster' &&
                `${activeCell.lineup} lineup, ${activeCell.sidelined} IR/B · `}
              {activeCell.points.toFixed(1)} pts)
            </span>
          </div>
          <div className="nba-injury-week-players">
            {activeCell.players
              .map(
                (p) =>
                  `${nameOf(p.player)} (${p.games}g${
                    summary.scope === 'roster' && p.lineup > 0 && p.sidelined > 0
                      ? `: ${p.lineup}L/${p.sidelined}IR`
                      : ''
                  }, ${p.points.toFixed(1)}p)`,
              )
              .join(' · ')}
          </div>
        </div>
      )}
      <div className="nba-scroll">
        <table className="nba-table nba-injury-heat">
          <thead>
            <tr>
              <th
                className="team-cell sticky"
                scope="col"
                style={{ textAlign: 'left' }}
              >
                Manager
              </th>
              {summary.weeks.map((w) => (
                <th
                  key={w.index}
                  scope="col"
                  title={`${shortDate(dateOfDay(league.opener, w.first))}–${shortDate(dateOfDay(league.opener, w.last))}`}
                >
                  {w.index}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((id) => {
              const t = byId.get(id)!;
              const team = league.teams.find((x) => x.id === id)!;
              const owner = personName(team);
              return (
                <tr key={id}>
                  <th className="team-cell sticky" scope="row">
                    <span className="who">{owner}</span>
                  </th>
                  {t.weeks.map((w, i) => {
                    const week = summary.weeks[i];
                    const isSelected =
                      active?.teamId === id && active?.weekIdx === i;
                    const who = w.players
                      .map((p) => `${lastName(nameOf(p.player))} ${p.games}`)
                      .join(', ');
                    return (
                      <td
                        key={week.index}
                        className={clsx({
                          'is-selected': isSelected && w.games > 0,
                          clickable: w.games > 0,
                        })}
                        style={
                          {
                            '--heat': `rgb(255 82 134 / ${(w.games / max) * 0.75})`,
                          } as React.CSSProperties
                        }
                        onMouseEnter={() =>
                          w.games > 0 && setSelected({ teamId: id, weekIdx: i })
                        }
                        onClick={() =>
                          w.games > 0 && setSelected({ teamId: id, weekIdx: i })
                        }
                        title={`Week ${week.index} (${shortDate(dateOfDay(league.opener, week.first))}–${shortDate(dateOfDay(league.opener, week.last))}) · ${owner}: ${w.games} ${w.games === 1 ? 'game' : 'games'} missed (${w.points.toFixed(1)} pts)${who ? ` — ${who}` : ''}`}
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

function AllTimeView({
  multiOnly,
  scope,
}: {
  multiOnly: boolean;
  scope: AbsenceScope;
}) {
  const { seasons, isPending } = useAllInjuries(true);
  const { rows, allPlayers } = useMemo(() => {
    const teamRows: (TeamInjuries & {
      season: number;
      owner: string;
      teamName: string;
      names: Record<string, string>;
    })[] = [];
    const playerRows: (PlayerInjury & {
      season: number;
      owner: string;
      playerName: string;
      proTeam?: number;
      opener: string;
    })[] = [];

    for (const { season, data, league } of seasons) {
      const s = summarizeInjuries(data, league, { multiOnly, scope });
      const names = league.names ?? {};
      const proTeams = league.proTeams ?? {};
      for (const t of s.teams) {
        const team = league.teams.find((x) => x.id === t.id);
        if (team?.owner) {
          teamRows.push({
            ...t,
            season,
            owner: team.owner,
            teamName: team.name,
            names,
          });
        }
      }
      for (const p of s.players) {
        const team = league.teams.find((x) => x.id === p.team);
        if (team?.owner) {
          playerRows.push({
            ...p,
            season,
            owner: team.owner,
            playerName: names[p.player] ?? `Player ${p.player}`,
            proTeam: proTeams[p.player],
            opener: league.opener,
          });
        }
      }
    }
    playerRows.sort((a, b) => b.points - a.points || b.lost - a.lost);
    return { rows: teamRows, allPlayers: playerRows };
  }, [seasons, multiOnly, scope]);

  const careers = useMemo(() => {
    const byOwner = new Map<
      string,
      {
        owner: string;
        seasons: number;
        luck: number;
        lost: number;
        points: number;
        lineup: number;
        sidelined: number;
        keptIn: number;
      }
    >();
    for (const r of rows) {
      const c = byOwner.get(r.owner) ?? {
        owner: r.owner,
        seasons: 0,
        luck: 0,
        lost: 0,
        points: 0,
        lineup: 0,
        sidelined: 0,
        keptIn: 0,
      };
      c.seasons++;
      c.luck += r.luck;
      c.lost += r.lost;
      c.points += r.points;
      c.lineup += r.lineup;
      c.sidelined += r.sidelined;
      c.keptIn += r.keptIn;
      byOwner.set(r.owner, c);
    }
    return [...byOwner.values()].sort((a, b) => a.luck / a.seasons - b.luck / b.seasons);
  }, [rows]);

  if (isPending) return <Loading label="Counting missed games" />;
  const worst = [...rows].sort((a, b) => a.luck - b.luck).slice(0, 12);
  const best = [...rows].sort((a, b) => b.luck - a.luck).slice(0, 6);

  return (
    <div className="nba-grid">
      <div className="nba-injury-main">
        <section className="nba-panel" aria-label="Unluckiest seasons">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Unluckiest seasons</h3>
          </div>
          <SeasonRows rows={worst} scope={scope} />
        </section>
        <section className="nba-panel" aria-label="Costliest player absences all-time">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Biggest player absences</h3>
          </div>
          <div className="nba-metric-heading nba-metric-heading-panel">
            Roto points missed
          </div>
          <ul className="nba-rows">
            {allPlayers.slice(0, 15).map((p) => (
              <li key={`${p.season}-${p.team}-${p.player}`} className="nba-row">
                <span className="nba-row-main">
                  <span className="nba-row-title">
                    <PlayerName name={p.playerName} proTeam={p.proTeam} />
                    {p.price !== undefined && (
                      <span className="nba-roster-tag">${p.price}</span>
                    )}
                  </span>
                  <span className="nba-row-sub">
                    {p.owner} ({seasonLabel(p.season)}) · <b>{p.lost} missed</b> (
                    {scope === 'roster'
                      ? `${p.lineup} lineup, ${p.sidelined} IR/B`
                      : `${p.surprise} surprise`}
                    ) · {p.played} played
                  </span>
                  <span className="nba-row-sub nba-faint">
                    {formatSpells(p.spells, p.opener, 2)}
                  </span>
                </span>
                <RowValue value={p.points} label={`${signed(p.luck)} luck`} />
              </li>
            ))}
          </ul>
        </section>
        <section className="nba-panel" aria-label="Luckiest seasons">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Luckiest seasons</h3>
          </div>
          <SeasonRows rows={best} scope={scope} />
        </section>
      </div>
      <div>
        <section className="nba-panel" aria-label="Career injury luck">
          <div className="nba-panel-head">
            <h3 className="nba-panel-title">Career luck</h3>
          </div>
          <div className="nba-metric-heading nba-metric-heading-panel">
            Pts a season vs expected
          </div>
          <ul className="nba-rows">
            {careers.map((c) => (
              <li key={c.owner} className="nba-row">
                <span className="nba-row-main">
                  <span className="nba-row-title">
                    <Link to={`/nba/managers/${slugify(c.owner)}`}>{c.owner}</Link>
                  </span>
                  <span className="nba-row-sub">
                    {c.seasons} {c.seasons === 1 ? 'season' : 'seasons'} ·{' '}
                    {Math.round(c.lost / c.seasons)}g/yr (
                    { (c.points / c.seasons).toFixed(1)} pts/yr)
                  </span>
                </span>
                <RowValue value={c.luck / c.seasons} sign />
              </li>
            ))}
          </ul>
        </section>
        <p className="nba-foot">
          Luck compares each season’s points missed with what that roster’s prior two-season
          histories predicted. Tap any season on the left to inspect its full player breakdown.
        </p>
      </div>
    </div>
  );
}

function SeasonRows({
  rows,
  scope,
}: {
  rows: (TeamInjuries & {
    season: number;
    owner: string;
    teamName: string;
    names: Record<string, string>;
  })[];
  scope: AbsenceScope;
}) {
  return (
    <ul className="nba-rows">
      {rows.map((r) => (
        <li key={`${r.season}-${r.id}`}>
          <Link
            to={`/nba/injuries?season=${r.season}&team=${r.id}${scope === 'lineup' ? '&scope=lineup' : ''}`}
            className="nba-row nba-row-link"
          >
            <span className="nba-row-main">
              <span className="nba-row-title">
                {r.owner} <span className="nba-faint">{seasonLabel(r.season)}</span>
              </span>
              <span className="nba-row-sub">
                {topMissedLabel(r, r.names, 3)}
              </span>
              <span className="nba-row-sub nba-faint">
                {r.lost} missed ({r.points.toFixed(1)} pts vs {r.expectedPoints.toFixed(1)}{' '}
                exp) · finished {ordinal(r.rank)}
                {r.healthyRank !== r.rank && `, healthy ${ordinal(r.healthyRank)}`}
              </span>
            </span>
            <RowValue value={r.luck} sign label="vs expected" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
