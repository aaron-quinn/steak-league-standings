import type { DraftPick, NbaLeague, NbaTeam } from './data';
import { buildProfile, type Build } from './profile';
import { isFinished } from './season';
import { buildStandings, type StandingRow } from './standings';

// One person across every season they played, from each season's owner
// names (ESPN accounts, renamed to match the NFL site)

export interface PersonSeason {
  season: number;
  team: NbaTeam;
  row: StandingRow;
  teamCount: number;
  // Games have been played (before then every team ties on every category)
  started: boolean;
  finished: boolean;
  cutoff: string | null;
  // The team's auction, priciest first, with player names
  draft: (DraftPick & { player: string })[];
}

export interface Person {
  name: string;
  slug: string;
  seasons: PersonSeason[];
  // Finished seasons only
  ate: number;
  bought: number;
  titles: number;
  // 1 for first, 0 for last, averaged over finished seasons
  averageFinish: number;
}

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function buildPeople(leagues: NbaLeague[]): Person[] {
  const people = new Map<string, Person>();
  for (const league of leagues) {
    const started = league.teams.some((t) => t.totals.some((v) => v > 0));
    const rows = buildStandings(league.teams);
    for (const row of rows) {
      // A spot nobody owns yet isn't a person
      if (!row.team.owner) continue;
      const slug = slugify(row.name);
      if (!people.has(slug)) {
        people.set(slug, { name: row.name, slug, seasons: [], ate: 0, bought: 0, titles: 0, averageFinish: 0 });
      }
      const finished = isFinished(league.season) && started;
      people.get(slug)!.seasons.push({
        season: league.season,
        team: row.team,
        row,
        teamCount: rows.length,
        started,
        finished,
        cutoff: league.cutoff,
        draft: league.draft
          .filter((p) => p.team === row.team.id)
          .map((p) => ({ ...p, player: league.names?.[p.playerID] ?? `Player ${p.playerID}` }))
          .sort((a, b) => b.price - a.price),
      });
    }
  }
  for (const person of people.values()) {
    person.seasons.sort((a, b) => b.season - a.season);
    const done = person.seasons.filter((s) => s.finished);
    person.ate = done.filter((s) => s.row.zone === 'eater').length;
    person.bought = done.length - person.ate;
    person.titles = done.filter((s) => s.row.position === 1).length;
    person.averageFinish = done.length
      ? done.reduce((sum, s) => sum + 1 - (s.row.position - 1) / (s.teamCount - 1), 0) / done.length
      : 0;
  }
  return [...people.values()].sort(
    (a, b) => b.ate - a.ate || a.bought - b.bought || a.name.localeCompare(b.name),
  );
}

export interface Tendencies {
  seasons: number;
  // Average shape, as categoryProfile
  shape: number[];
  // Average rank per category
  ranks: number[];
  builds: Record<Build, number>;
  // The build used in at least half their seasons, if any
  usual: Build | null;
  // Categories punted, with how many times, most first
  punts: { category: number; times: number }[];
  best: number;
  worst: number;
}

// Habits across a person's finished seasons
export function tendencies(person: Person): Tendencies | null {
  const done = person.seasons.filter((s) => s.finished);
  if (!done.length) return null;
  const profiles = done.map((s) =>
    buildProfile(
      s.row.categories.map((c) => c.points),
      s.teamCount,
    ),
  );
  const shape = categoryProfile(person);
  const ranks = shape.map(
    (_, i) =>
      done.reduce((sum, s) => sum + s.teamCount + 1 - s.row.categories[i].points, 0) /
      done.length,
  );
  const builds: Record<Build, number> = { guards: 0, bigs: 0, balanced: 0 };
  const punted = new Map<number, number>();
  for (const p of profiles) {
    builds[p.build]++;
    for (const i of p.punts) punted.set(i, (punted.get(i) ?? 0) + 1);
  }
  // A lean counts first: half a career in guard builds is a habit
  const usual = (['guards', 'bigs', 'balanced'] as const).find((b) => builds[b] * 2 >= done.length);
  const order = shape.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  return {
    seasons: done.length,
    shape,
    ranks,
    builds,
    usual: usual ?? null,
    punts: [...punted]
      .map(([category, times]) => ({ category, times }))
      .sort((a, b) => b.times - a.times),
    best: order[0].i,
    worst: order[order.length - 1].i,
  };
}

// How strong a person has been in each category: their roto points there as
// a share of the way from last (0) to first (1), averaged over seasons
export function categoryProfile(person: Person) {
  const done = person.seasons.filter((s) => s.finished);
  if (!done.length) return [];
  return done[0].row.categories.map((_, i) =>
    done.reduce(
      (sum, s) => sum + (s.row.categories[i].points - 1) / (s.teamCount - 1),
      0,
    ) / done.length,
  );
}
