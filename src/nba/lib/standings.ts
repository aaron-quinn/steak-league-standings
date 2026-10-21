import type { NbaDay, NbaLeague, NbaTeam } from './data';
import { scoreRoto, type CategoryResult, type StatLine } from './roto.ts';

export type SteakZone = 'eater' | 'self-buyer' | 'buyer';

// Same rule as the NFL site: half the field eats; with an odd count the middle
// team buys its own
export function steakZone(position: number, teamCount: number): SteakZone {
  const eaters = Math.floor(teamCount / 2);
  if (position <= eaters) return 'eater';
  if (teamCount % 2 && position === eaters + 1) return 'self-buyer';
  return 'buyer';
}

export interface StandingRow {
  team: NbaTeam;
  // The person, or the team name while a spot has no owner
  name: string;
  points: number;
  categories: CategoryResult[];
  // Shared by tied teams, as ESPN shows it
  rank: number;
  // Order down the table (ties broken by name, as the NFL site does), which
  // decides the steak zone
  position: number;
  zone: SteakZone;
}

export const personName = (team: NbaTeam) => team.owner || team.name;

export function lastName(name: string) {
  return name.split(' & ')[0].split(' ').slice(1).join(' ') || name;
}

export function buildStandings(
  teams: NbaTeam[],
  totals: Map<number, StatLine> = new Map(teams.map((t) => [t.id, t.totals])),
): StandingRow[] {
  const byID = new Map(teams.map((t) => [t.id, t]));
  const scored = scoreRoto(totals)
    .map((r) => ({ ...r, team: byID.get(r.id)! }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        personName(a.team).localeCompare(personName(b.team)),
    );
  return scored.map((r, i) => ({
    team: r.team,
    name: personName(r.team),
    points: r.points,
    categories: r.categories,
    rank: 1 + scored.filter((o) => o.points > r.points + 1e-9).length,
    position: i + 1,
    zone: steakZone(i + 1, scored.length),
  }));
}

export interface PlayingTime {
  games: number;
  minutes: number;
}

// Games and minutes each team got from its active lineup (bench and IR don't
// count), through the last day that counts. Empty for a season without player
// lines (2017-18, from Yahoo).
export function playingTime(days: NbaDay[], lastDay: number) {
  const time = new Map<number, PlayingTime>();
  const of = (team: number) => {
    let t = time.get(team);
    if (!t) time.set(team, (t = { games: 0, minutes: 0 }));
    return t;
  };
  for (const day of days) {
    if (day.day > lastDay) continue;
    for (const [team, , slot, played] of day.players) {
      if (slot === 12 || slot === 13) continue;
      of(team).games += played;
    }
    for (const [team, minutes] of Object.entries(day.minutes ?? {})) {
      of(Number(team)).minutes += minutes;
    }
  }
  return time;
}

// A season with no games yet has nothing to rank
export const hasStarted = (league: NbaLeague) =>
  league.teams.some((t) => t.totals.some((v) => v > 0));

export interface SeasonResult {
  season: number;
  champion: string;
  // Person → ate the steak (true) or bought (false)
  steaks: Map<string, boolean>;
}

export function seasonResult(league: NbaLeague): SeasonResult {
  const rows = buildStandings(league.teams);
  return {
    season: league.season,
    champion: rows[0]?.name ?? '',
    steaks: new Map(rows.map((r) => [r.name, r.zone === 'eater'])),
  };
}
