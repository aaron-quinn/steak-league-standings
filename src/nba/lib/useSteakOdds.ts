import { useCallback, useMemo } from 'react';
import { useLeague, useOddsBasis, useSeasonTotals, useTonight } from './data';
import { currentOdds, gamesSoFar, oddsHistory, todayPlayed } from './season-odds';
import { dateOfDay, isFinished } from './season';
import { buildStandings, hasStarted } from './standings';
import { isTombstoned, tombstoned, type Comeback } from './tombstone';

// Buried means past the history line AND under this chance of eating. Checked
// leaving each season out (scripts/nba/backtest-tombstones.mjs): the line
// alone buried 578 team-weeks and 16 of those teams ate; with odds under 5%
// too, 366 team-weeks and none ate. Every team that climbed out still had at
// least 9% at the time.
export const TOMBSTONE_ODDS = 0.05;

// Lineup weeks still to finish: the Sundays after today, plus the last day
function weeksLeftNow(opener: string, latestDay: number, finalDay: number) {
  let left = 0;
  for (let day = latestDay + 1; day <= finalDay; day++) {
    if (dateOfDay(opener, day).getUTCDay() === 0 || day === finalDay) left++;
  }
  return left;
}

// Everything Steak Odds needs: the model (fitted without this season), the
// week-by-week history, today's odds, and who's tombstoned
export function useSteakOdds(
  season: number,
  { withHistory = true, enabled = true } = {},
) {
  const { data: league } = useLeague(season);
  const finished = isFinished(season);

  // The model and the comeback line, fitted from every other finished season
  // at build time (scripts/nba/build-odds.mjs)
  const basis = useOddsBasis(season);
  const model = basis?.model ?? null;
  const line = basis?.line ?? null;

  // How far each team trails the last eating spot today
  const behind = useMemo(() => {
    if (!league || finished) return null;
    const rows = buildStandings(league.teams);
    const eaters = Math.floor(rows.length / 2);
    const bar = rows[eaters - 1]?.points ?? 0;
    return {
      teams: rows.map((r) => ({ id: r.team.id, name: r.name, deficit: Math.max(0, bar - r.points) })),
      weeksLeft: weeksLeftNow(league.opener, league.latestDay, league.finalDay),
    };
  }, [league, finished]);
  // A tombstone also takes odds under 5%, but only a team past the history
  // line can get one. Until a team is, the pit needs no odds, which spares the
  // standings the simulation (a few hundred ms on a phone) and every day's
  // lines it runs on.
  const pastLine = Boolean(
    behind && line && behind.teams.some((t) => isTombstoned(t.deficit, behind.weeksLeft, line)),
  );
  const needOdds = withHistory || pastLine;

  // Today's odds project per game played. The Worker tallies the live
  // season's games, so they don't take every day's lines; until its tally
  // catches up they're counted from those lines here.
  const tallied = useMemo(
    () =>
      league?.games
        ? new Map(league.teams.map((t) => [t.id, league.games![t.id] ?? 0]))
        : null,
    [league],
  );
  // A season's day-by-day totals: the history needs them, and so do today's
  // odds when the games aren't tallied
  const { totals } = useSeasonTotals(
    season,
    enabled && (withHistory || (!finished && needOdds && !tallied)),
  );
  const games = useMemo(
    () => tallied ?? (totals ? gamesSoFar(totals) : null),
    [tallied, totals],
  );

  // How much of today is played, so tonight's games still to come are
  // projected rather than dropped
  const { data: tonight } = useTonight(season);
  const played = league ? todayPlayed(tonight, league.latestDay) : 0;

  const started = league ? hasStarted(league) : false;
  const now = useMemo(
    () =>
      needOdds && league && model && games && !finished && started
        ? currentOdds(league, model, games, played)
        : null,
    [needOdds, league, model, games, finished, started, played],
  );

  const simulated = useMemo(
    () =>
      withHistory && league && model && totals
        ? oddsHistory(league, totals, model, finished ? league.lastDay : league.finalDay)
        : null,
    [withHistory, league, model, totals, finished],
  );
  // The live season's newest point is today, still being played: show
  // today's odds there, which project the games still to come
  const history = useMemo(() => {
    const end = (simulated?.race.checkpoints.length ?? 0) - 1;
    if (!simulated || !now || !league || simulated.race.checkpoints[end]?.day !== league.latestDay) {
      return simulated;
    }
    const eat = new Map(
      [...simulated.eat].map(([id, odds]) => [id, odds.map((p, i) => (i === end ? (now.get(id)?.eat ?? p) : p))]),
    );
    return { ...simulated, eat };
  }, [simulated, now, league]);

  // Today's pit: how far each team trails the last eating spot
  const pitNow = useMemo(() => {
    if (!behind || !line || (needOdds && !now)) return null;
    return pit(behind.teams, behind.weeksLeft, line, (id) => now?.get(id)?.eat ?? 1);
  }, [behind, line, needOdds, now]);

  // A past season's pit at any week of the replay
  const pitAt = useCallback((week: number) => {
    if (!history || !line) return null;
    const { race, eat } = history;
    const end = race.checkpoints.length - 1;
    const buried = tombstoned(race, week, line);
    const eaters = Math.floor(race.teams.length / 2);
    const bar = race.teams.find((t) => t.positions[week] === eaters)?.points[week] ?? 0;
    return pit(
      race.teams.map((t) => ({ id: t.id, name: t.name, deficit: Math.max(0, bar - t.points[week]) })),
      end - week,
      line,
      (id) => (buried.has(id) ? eat.get(id)![week] : 1),
    );
  }, [history, line]);

  return { league, model, history, now, line, pitNow, pitAt, ready: Boolean(league && model) };
}

export interface Pit {
  weeksLeft: number;
  // The deepest comeback at this point of a season or later, if any
  record: Comeback | null;
  // Every team behind the steak line, deepest last
  chasers: { id: number; name: string; deficit: number; buried: boolean }[];
  buried: Set<number>;
}

function pit(
  teams: { id: number; name: string; deficit: number }[],
  weeksLeft: number,
  line: (Comeback | null)[],
  eatOdds: (id: number) => number,
): Pit {
  const known = weeksLeft < line.length;
  const chasers = teams
    .filter((t) => t.deficit > 0)
    .map((t) => ({
      ...t,
      buried: isTombstoned(t.deficit, weeksLeft, line) && eatOdds(t.id) < TOMBSTONE_ODDS,
    }))
    .sort((a, b) => a.deficit - b.deficit);
  return {
    weeksLeft,
    record: known ? (line[weeksLeft] ?? null) : null,
    chasers,
    buried: new Set(chasers.filter((c) => c.buried).map((c) => c.id)),
  };
}
