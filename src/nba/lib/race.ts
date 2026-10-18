import type { NbaLeague, NbaTotals } from './data';
import { ordinal, plural } from './format';
import { addLine, emptyLine, type StatLine } from './roto';
import { dateOfDay } from './season';
import { buildStandings, lastName, personName, type SteakZone } from './standings';

export interface RaceTeam {
  id: number;
  name: string;
  short: string;
  // Position down the standings (the steak order) and roto points at each
  // checkpoint
  positions: number[];
  points: number[];
  zones: SteakZone[];
}

export interface Race {
  // The end of each lineup week (lineups lock on Mondays), and the last day
  checkpoints: { day: number; date: Date }[];
  teams: RaceTeam[];
}

// Last names, or first initial too where two people share one
function shortNames(names: string[]) {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(lastName(n), (counts.get(lastName(n)) ?? 0) + 1);
  return names.map((n) =>
    (counts.get(lastName(n)) ?? 0) > 1 ? `${n[0]}. ${lastName(n)}` : lastName(n),
  );
}

export function buildRace(league: NbaLeague, totals: NbaTotals): Race {
  const teams = league.teams;
  const shorts = shortNames(teams.map(personName));
  const race: RaceTeam[] = teams.map((t, i) => ({
    id: t.id,
    name: personName(t),
    short: shorts[i],
    positions: [],
    points: [],
    zones: [],
  }));
  const byID = new Map(race.map((t) => [t.id, t]));
  const running = new Map<number, StatLine>(teams.map((t) => [t.id, emptyLine()]));
  const checkpoints: Race['checkpoints'] = [];

  totals.days.forEach((day, i) => {
    for (const t of teams) addLine(running.get(t.id)!, totals.teams[t.id]?.[i] ?? emptyLine());
    const date = dateOfDay(league.opener, day);
    const last = i === totals.days.length - 1;
    // Sunday ends a lineup week; skip a first "week" of only a day or two
    if (!(date.getUTCDay() === 0 && i >= 2) && !last) return;
    checkpoints.push({ day, date });
    for (const row of buildStandings(teams, running)) {
      const team = byID.get(row.team.id)!;
      team.positions.push(row.position);
      team.points.push(row.points);
      team.zones.push(row.zone);
    }
  });

  return { checkpoints, teams: race };
}

export interface RaceFact {
  label: string;
  value: string;
  detail: string;
  teamID?: number;
}

// Headline moments, for the cards under the chart
export function raceFacts(race: Race): RaceFact[] {
  const { teams, checkpoints } = race;
  if (checkpoints.length < 2) return [];
  const n = teams.length;
  const end = checkpoints.length - 1;
  const facts: RaceFact[] = [];

  const weeksOnTop = teams
    .map((t) => ({ t, weeks: t.positions.filter((p) => p === 1).length }))
    .sort((a, b) => b.weeks - a.weeks)[0];
  facts.push({
    label: 'Most weeks on top',
    value: weeksOnTop.t.short,
    detail: `${weeksOnTop.weeks} of ${checkpoints.length} weeks in 1st`,
    teamID: weeksOnTop.t.id,
  });

  const climbs = teams
    .filter((t) => t.zones[end] === 'eater')
    .map((t) => {
      const worst = Math.max(...t.positions.slice(Math.min(2, end)));
      return { t, worst, gain: worst - t.positions[end] };
    })
    .sort((a, b) => b.gain - a.gain)[0];
  if (climbs?.gain > 0) {
    facts.push({
      label: 'Best comeback',
      value: climbs.t.short,
      detail: `From ${ordinal(climbs.worst)} to ${ordinal(climbs.t.positions[end])}`,
      teamID: climbs.t.id,
    });
  }

  const falls = teams
    .filter((t) => t.zones[end] !== 'eater')
    .map((t) => {
      const best = Math.min(...t.positions.slice(Math.min(2, end)));
      return { t, best, drop: t.positions[end] - best };
    })
    .sort((a, b) => b.drop - a.drop)[0];
  if (falls?.drop > 0) {
    facts.push({
      label: 'Worst collapse',
      value: falls.t.short,
      detail: `From ${ordinal(falls.best)} to ${ordinal(falls.t.positions[end])}`,
      teamID: falls.t.id,
    });
  }

  const crossings = teams
    .map((t) => ({
      t,
      count: t.zones.filter((z, i) => i > 0 && (z === 'eater') !== (t.zones[i - 1] === 'eater')).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  if (crossings.count > 0) {
    facts.push({
      label: 'Most line crossings',
      value: crossings.t.short,
      detail: `Crossed the steak line ${crossings.count} times`,
      teamID: crossings.t.id,
    });
  }

  const eaters = Math.floor(n / 2);
  const last = teams.find((t) => t.positions[end] === eaters);
  const first = teams.find((t) => t.positions[end] === eaters + 1);
  if (last && first) {
    const gap = last.points[end] - first.points[end];
    facts.push({
      label: 'Last one in',
      value: last.short,
      detail: `${plural(gap, 'point')} clear of ${first.short}`,
      teamID: last.id,
    });
  }
  return facts;
}
