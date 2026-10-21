import { useCallback, useMemo } from 'react';
import { useAllLeagues, useHistoricalTotals, useLeague, useSeasonTotals } from './data';
import { buildRace } from './race';
import { currentOdds, gamesSoFar, modelFor, oddsHistory } from './season-odds';
import { dateOfDay, isFinished } from './season';
import { buildStandings, hasStarted } from './standings';
import { isTombstoned, tombstoneLine, tombstoned, type Comeback } from './tombstone';

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
  const { leagues } = useAllLeagues();
  const { seasons: past, isPending: pastPending } = useHistoricalTotals(enabled);
  const finished = isFinished(season);
  // A season's day-by-day totals: the history needs them, and today's odds
  // need the live season's games so far (they project per game played)
  const { totals } = useSeasonTotals(season, enabled && (withHistory || !finished));

  const pastSeasons = useMemo(() => {
    if (pastPending) return null;
    const out = past.flatMap(({ season: s, totals: t }) => {
      const l = leagues.find((x) => x.season === s);
      return l ? [{ season: s, totals: t, league: l, lastDay: l.lastDay }] : [];
    });
    return out.length === past.length ? out : null;
  }, [past, pastPending, leagues]);

  const model = useMemo(
    () => (pastSeasons ? modelFor(season, pastSeasons) : null),
    [pastSeasons, season],
  );

  // The comeback line from every other finished season
  const line = useMemo(
    () =>
      pastSeasons
        ? tombstoneLine(
            pastSeasons
              .filter((p) => p.season !== season)
              .map((p) => ({ season: p.season, race: buildRace(p.league, p.totals) })),
          )
        : null,
    [pastSeasons, season],
  );

  const started = league ? hasStarted(league) : false;
  const now = useMemo(
    () =>
      league && model && totals && !finished && started
        ? currentOdds(league, model, gamesSoFar(totals))
        : null,
    [league, model, totals, finished, started],
  );

  const history = useMemo(
    () =>
      withHistory && league && model && totals
        ? oddsHistory(league, totals, model, finished ? league.lastDay : league.finalDay)
        : null,
    [withHistory, league, model, totals, finished],
  );

  // Today's pit: how far each team trails the last eating spot
  const pitNow = useMemo(() => {
    if (!league || !line || !now || finished) return null;
    const rows = buildStandings(league.teams);
    const eaters = Math.floor(rows.length / 2);
    const bar = rows[eaters - 1]?.points ?? 0;
    const weeksLeft = weeksLeftNow(league.opener, league.latestDay, league.finalDay);
    return pit(
      rows.map((r) => ({ id: r.team.id, name: r.name, deficit: Math.max(0, bar - r.points) })),
      weeksLeft,
      line,
      (id) => now.get(id)?.eat ?? 1,
    );
  }, [league, line, now, finished]);

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
