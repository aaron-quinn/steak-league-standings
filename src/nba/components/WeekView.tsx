import clsx from 'clsx';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSchedule, useSeasonDays, useTonight, type NbaLeague } from '../lib/data';
import { dateOfDay } from '../lib/season';
import { lastName, type StandingRow } from '../lib/standings';
import { lineupWeeks, weekGames, type Cell, type WeekTeam } from '../lib/week';
import { Loading } from './Shell';
import PlayerName from './PlayerName';

type Count = 'scheduled' | 'played' | 'lost' | 'upcoming';
type SortKey = 'position' | Count;

const COLUMNS: { key: Count; label: string; title: string }[] = [
  { key: 'scheduled', label: 'Sched', title: 'Games on the starters’ NBA schedules this week' },
  { key: 'played', label: 'Played', title: 'Games played (including any on now)' },
  { key: 'lost', label: 'Lost', title: 'Games a starter sat out: injury, rest or coach’s call' },
  { key: 'upcoming', label: 'Left', title: 'Games still to come' },
];

const CELL_LABEL: Record<Cell, string> = {
  played: 'Played',
  live: 'Playing now',
  lost: 'Didn’t play',
  upcoming: 'To play',
  off: 'No game',
  out: 'Not in the lineup',
};

// One block per game in state order, padded with empty blocks to the busiest
// team's count so every bar has the same slots
const blocks = (t: WeekTeam, slots: number) => [
  ...Array<string>(t.played).fill('played'),
  ...Array<string>(t.live).fill('live'),
  ...Array<string>(t.lost).fill('lost'),
  ...Array<string>(t.upcoming).fill('upcoming'),
  ...Array<string>(Math.max(0, slots - t.scheduled)).fill('empty'),
];

const value = (t: WeekTeam, key: Count) =>
  key === 'played' ? t.played + t.live : t[key];

// Each team's games for a lineup week: scheduled, played, lost to starters
// sitting out, and left. Sort by any column; open a team to see its starters
// day by day.
export default function WeekView({ league, rows }: { league: NbaLeague; rows: StandingRow[] }) {
  const season = league.season;
  const weeks = useMemo(() => lineupWeeks(league.opener, league.finalDay), [league.opener, league.finalDay]);
  const currentIndex = weeks.find((w) => league.latestDay >= w.first && league.latestDay <= w.last)?.index ?? 1;
  const [selectedIndex, setIndex] = useState<number | null>(null);
  const index = selectedIndex ?? currentIndex;
  const week = weeks[index - 1];
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'position', desc: false });
  const [opened, setOpened] = useState<Set<number>>(() => new Set());

  const { days, names, proTeams, isPending, isError: daysFailed } = useSeasonDays(season);
  const { data: schedule, isError: scheduleFailed } = useSchedule(season);
  const { data: tonight, isError: tonightFailed } = useTonight(season);
  const games = useMemo(
    () =>
      days && schedule && week
        ? weekGames({ week, days, latestDay: league.latestDay, schedule, names, proTeams, today: tonight })
        : null,
    [days, schedule, week, league.latestDay, names, proTeams, tonight],
  );

  if (daysFailed || scheduleFailed || tonightFailed) {
    return <div className="nba-empty"><b>Weekly games unavailable</b>ESPN didn&rsquo;t return all the lineups or schedules. Reload to try again.</div>;
  }
  if (isPending || !games || !tonight) return <Loading label="Loading the week" />;
  const requiredDays = games.days.filter((day) => day <= league.latestDay);
  if (!Object.keys(schedule ?? {}).length || requiredDays.some((day) => !days?.some((d) => d.day === day && d.rosters && d.slots))) {
    return <div className="nba-empty"><b>Weekly games unavailable</b>Some lineup or schedule data is missing. Try again in a minute.</div>;
  }

  const teams = rows
    .map((row) => ({ row, week: games.teams.get(row.team.id) }))
    .filter((t): t is { row: StandingRow; week: WeekTeam } => Boolean(t.week));
  const sorted = [...teams].sort((a, b) => {
    const diff =
      sort.key === 'position'
        ? a.row.position - b.row.position
        : value(a.week, sort.key) - value(b.week, sort.key);
    return (sort.desc ? -diff : diff) || a.row.position - b.row.position;
  });
  const most = Math.max(1, ...teams.map((t) => t.week.scheduled));
  const average = (key: Count) =>
    teams.reduce((sum, t) => sum + value(t.week, key), 0) / (teams.length || 1);
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'position' }));
  const toggleOpen = (id: number) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const short = (day: number) =>
    dateOfDay(league.opener, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const sortHeader = (key: SortKey, label: string, title?: string, className?: string) => (
    <th
      key={key}
      scope="col"
      className={className}
      title={title}
      aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : undefined}
    >
      <button type="button" className="nba-sort" onClick={() => toggleSort(key)}>
        {label}
      </button>
    </th>
  );

  return (
    <div className="nba-week">
      <div className="nba-week-head">
        <div className="nba-week-step">
          <button type="button" aria-label="Previous week" disabled={index <= 1} onClick={() => setIndex(index - 1)}>
            ‹
          </button>
          <span>
            <b>Week {week.index}</b> · {short(week.first)} – {short(week.last)}
            {index === currentIndex && <span className="nba-faint"> · this week</span>}
          </span>
          <button
            type="button"
            aria-label="Next week"
            disabled={index >= currentIndex}
            onClick={() => setIndex(index + 1)}
          >
            ›
          </button>
        </div>
        <ul className="nba-week-legend" aria-label="Key">
          <li><i className="played" /> Played</li>
          <li><i className="live" /> On now</li>
          <li><i className="lost" /> Lost</li>
          <li><i className="upcoming" /> To play</li>
        </ul>
      </div>

      <table className="nba-table nba-week-table">
        <caption className="sr-only">
          Each team’s starters’ games in week {week.index}: scheduled, played, lost and left.
        </caption>
        <thead>
          <tr>
            {sortHeader('position', '#', 'Standings order', 'rank')}
            <th scope="col" style={{ textAlign: 'left' }}>
              Team
            </th>
            {COLUMNS.map((c) => sortHeader(c.key, c.label, c.title, 'num'))}
          </tr>
        </thead>
        {sorted.map(({ row, week: t }) => {
          const open = opened.has(row.team.id);
          return (
            <tbody key={row.team.id} className="team">
              <tr className={clsx('openable', { open })} onClick={() => toggleOpen(row.team.id)}>
                <td className="rank">{row.position}</td>
                <td className="team-cell">
                  <div className="nba-week-line">
                    <button
                      type="button"
                      className="who nba-week-toggle"
                      aria-label={row.name}
                      title={row.name}
                      aria-expanded={open}
                      aria-controls={open ? `week-team-${row.team.id}` : undefined}
                      onClick={(e) => { e.stopPropagation(); toggleOpen(row.team.id); }}
                    >
                      <FittingTeamName name={row.name} />
                    </button>
                    <span className="nba-week-bar" aria-hidden="true">
                      {blocks(t, most).map((state, i) => (
                        <span key={i} className={state} />
                      ))}
                    </span>
                  </div>
                </td>
                <td className="num">{t.scheduled}</td>
                <td className="num">{t.played + t.live}</td>
                <td className={clsx('num', { 'nba-bad': t.lost > 0 })}>{t.lost}</td>
                <td className="num">{t.upcoming}</td>
              </tr>
              {open && (
                <tr className="nba-box-row">
                  <td colSpan={6}>
                    <div id={`week-team-${row.team.id}`} className="nba-box nba-week-grid">
                      <table>
                        <caption className="sr-only">{row.name}&rsquo;s starters in week {week.index}</caption>
                        <thead>
                          <tr>
                            <th scope="col" className="player">
                              Starter
                            </th>
                            {games.days.map((day) => (
                              <th key={day} scope="col" className={clsx({ today: day === league.latestDay })}>
                                {dateOfDay(league.opener, day).toLocaleDateString('en-US', {
                                  weekday: 'narrow',
                                  timeZone: 'UTC',
                                })}
                                <small>{dateOfDay(league.opener, day).getUTCDate()}</small>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.starters.map((s) => (
                            <tr key={s.id}>
                              <th scope="row" className="player">
                                <PlayerName name={s.name} proTeam={s.proTeam} />
                              </th>
                              {s.cells.map((c, i) => (
                                <td
                                  key={i}
                                  className={clsx({ today: games.days[i] === league.latestDay })}
                                  title={`${short(games.days[i])}: ${CELL_LABEL[c]}`}
                                >
                                  <i className={c} role="img" aria-label={CELL_LABEL[c]} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
        <tfoot>
          <tr>
            <td />
            <td className="team-cell">
              <span className="who nba-dim">League average</span>
            </td>
            {COLUMNS.map((c) => (
              <td key={c.key} className="num nba-dim">
                {average(c.key).toFixed(1)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="nba-foot" style={{ margin: '0 12px 12px', paddingTop: 12 }}>
        Weekly starters only; bench and IR excluded. Future days use
        today&rsquo;s lineup. Played includes games on now. Lost means a
        starter missed a completed game: injury, rest or a coach&rsquo;s call.
        ESPN doesn&rsquo;t distinguish those reasons here. Bars share the
        same scale. Tap a team for its daily calendar; tap a column to sort.
      </p>
    </div>
  );
}

// Measure the full name independently of the displayed label, so shortening
// it can't cause a resize loop. Watching both also catches webfont loading.
function FittingTeamName({ name }: { name: string }) {
  const container = useRef<HTMLSpanElement>(null);
  const full = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const label = container.current;
    const measure = full.current;
    if (!label || !measure) return;
    const update = () => setCompact(measure.getBoundingClientRect().width > label.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(label);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [name]);

  return (
    <span ref={container} className="nba-week-name">
      <span ref={full} className="nba-week-name-measure" aria-hidden="true">{name}</span>
      {compact ? lastName(name) : name}
    </span>
  );
}
