import { useMemo } from 'react';
import type { NbaLeague } from './data';
import { useAllLeagues, useAllTimeDays } from './data';
import { buildDraft, buildPickups, buildTrades } from './moves';
import type { DraftRow, Pickup, Trade } from './moves';
import { buildPeople } from './people';
import { isFinished } from './season';
import { pointRates } from './value';

// Cross-season views for the Draft, Waivers and Trades screens, and the career
// table on Standings. Every finished season is built with its own roto rates,
// then the rows are pooled and tagged with the season they came from.

export type Dated<T> = T & { season: number };

export interface AllTimeMoves {
  draft: Dated<DraftRow>[];
  pickups: Dated<Pickup>[];
  trades: Dated<Trade>[];
  // Latest NBA team recorded for each player, for the little logos
  proTeams: Record<number, number>;
  // Each season's opening night, to date its days
  openers: Record<number, string>;
  isPending: boolean;
}

const EMPTY: AllTimeMoves = {
  draft: [],
  pickups: [],
  trades: [],
  proTeams: {},
  openers: {},
  isPending: false,
};

// Pass enabled = false until the All-Time view is chosen: nothing downloads
// until then. The finished seasons come from the static files, so this never
// touches the Worker.
export function useAllTimeMoves(enabled: boolean): AllTimeMoves {
  const { leagues, isPending: leaguesPending } = useAllLeagues(enabled);
  const { seasons: daysBySeason, isPending: daysPending } = useAllTimeDays(enabled);

  return useMemo(() => {
    if (!enabled) return EMPTY;
    if (leaguesPending || daysPending) return { ...EMPTY, isPending: true };
    const finished = leagues
      .filter((l) => isFinished(l.season))
      .sort((a, b) => a.season - b.season);
    // Nothing loaded: the static files are missing or every request failed
    if (!finished.length) return EMPTY;
    // Every finished season must have its days before the totals mean anything
    if (daysBySeason.length < finished.length) return { ...EMPTY, isPending: true };

    const draft: Dated<DraftRow>[] = [];
    const pickups: Dated<Pickup>[] = [];
    const trades: Dated<Trade>[] = [];
    const proTeams: Record<number, number> = {};
    const openers: Record<number, string> = {};
    for (const league of finished) {
      const days = daysBySeason.find((d) => d.season === league.season)?.days;
      if (!days) continue;
      const names = league.names ?? {};
      const rates = pointRates(league);
      openers[league.season] = league.opener;
      draft.push(...buildDraft(league, days, names, rates).map((r) => ({ ...r, season: league.season })));
      pickups.push(...buildPickups(league, days, names, rates).map((r) => ({ ...r, season: league.season })));
      trades.push(...buildTrades(league, days, names, rates).map((r) => ({ ...r, season: league.season })));
      if (league.proTeams) Object.assign(proTeams, league.proTeams);
    }
    return { draft, pickups, trades, proTeams, openers, isPending: false };
  }, [enabled, leagues, daysBySeason, leaguesPending, daysPending]);
}

export interface CareerRow {
  name: string;
  slug: string;
  seasons: number;
  titles: number;
  ate: number;
  bought: number;
  // Career roto points across finished seasons
  points: number;
  best: number | null;
  // 1 for first, 0 for last, averaged over finished seasons
  averageFinish: number;
}

// Every manager's finished seasons rolled into one row, for the career table
export function careerTable(leagues: NbaLeague[]): CareerRow[] {
  return buildPeople(leagues)
    .flatMap((person) => {
      const done = person.seasons.filter((s) => s.finished);
      if (!done.length) return [];
      return [
        {
          name: person.name,
          slug: person.slug,
          seasons: done.length,
          titles: person.titles,
          ate: person.ate,
          bought: person.bought,
          points: done.reduce((sum, s) => sum + s.row.points, 0),
          best: Math.min(...done.map((s) => s.row.position)),
          averageFinish: person.averageFinish,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.titles - a.titles ||
        b.averageFinish - a.averageFinish ||
        a.name.localeCompare(b.name),
    );
}
