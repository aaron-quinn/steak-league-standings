// Games each fantasy team lost to absences: a player on the roster whose NBA
// team played without him. Lineups are weekly, so a starter who goes down
// mid-week costs his team a zero in that lineup slot until the next week;
// once the next week's lineup locks, managers usually move him to IR or the
// bench while he's out (or leave him in the starting lineup: "kept in"). Both
// in-lineup losses and games missed while sidelined on IR or the bench are
// recorded so you can see every player a team has been missing out on, or
// narrow to active lineup slots alone.
//
// ESPN keeps no record of why a player sat, only that he did. A run of two or
// more missed games reads as an injury; a lone missed game is rest, illness or
// a minor knock.
//
// buildInjuryData reads the daily lineups (scripts/nba/build-injuries.mjs for
// finished seasons, the live chunks for the current one) into the compact
// InjuryData; summarizeInjuries prices it in roto points.
import type { NbaLeague, PlayerLine } from './data';
import type { PlayerPool } from './comps';
import { addLine, emptyLine, scoreRoto, type StatLine } from './roto.ts';
import { nbaTeamOnDay, teamsByDay, type NbaSchedule } from './schedule.ts';
import { linePoints, pointRates } from './value.ts';
import { lineupWeeks, type LineupWeek } from './week.ts';

const BENCH = 12;
const IR = 13;
const isStarter = (slot: number | undefined) => slot !== undefined && slot !== BENCH && slot !== IR;

export type AbsenceScope = 'roster' | 'lineup';

export interface InjuryDay {
  day: number;
  rosters?: Record<string, number[]>;
  slots?: Record<string, number>;
  players: PlayerLine[];
  playedFor?: Record<string, number>;
}

// [fantasy team, player, day, first day of his absence, games the absence ran,
// slot kind: omitted/0 = starter, 1 = bench, 2 = IR]
export type Miss = [number, number, number, number, number, number?];

export interface InjuryData {
  // The last day counted
  through: number;
  // [fantasy team, player, starter games (played + missed), total games played on roster]
  starts: [number, number, number, number?][];
  misses: Miss[];
  // Player → [games, ...stat totals]: his season while rostered, padded to
  // MIN_LINE_GAMES from his last two seasons when he played fewer
  lines: Record<string, number[]>;
  // Player → share of his NBA team's games he missed over the last two
  // seasons, pulled toward the league's usual share by how little of them
  // there is
  rates: Record<string, number>;
}

export interface InjuryInput {
  days: InjuryDay[];
  schedule: NbaSchedule;
  through: number;
  names: Record<string, string>;
  proTeams: Record<string, number>;
  // Earlier seasons' totals for every NBA player, newest first
  priors: PlayerPool[];
}

// How much a typical rotation player misses, and how many games of history
// it takes to count as much as that typical share
const USUAL_MISS_RATE = 0.15;
const RATE_WEIGHT = 41;

// Pad small in-season samples up to this many games with the prior two seasons
// so a star hurt early (or anyone in the opening weeks) is valued accurately
const MIN_LINE_GAMES = 25;
// Minimum auction price for an unplayed 0-game IR stash (e.g. $40 Zion in 2022)
// to count as a core absence rather than a $1–$4 end-of-draft lottery ticket
const MIN_STASH_PRICE = 5;

// A season's length in games: what nearly every full-season player reached
// (traded players can play a few more)
export function seasonGames(pool: PlayerPool) {
  const games = pool.players.map((p) => p[1]).sort((a, b) => a - b);
  return games[Math.floor(games.length * 0.95)] ?? 82;
}

export function missRates(ids: Iterable<number>, names: Record<string, string>, priors: PlayerPool[]) {
  const pools = priors.slice(0, 2).map((pool) => ({
    games: seasonGames(pool),
    byName: new Map(pool.players.map((p) => [p[0], p[1]])),
  }));
  const rates: Record<string, number> = {};
  for (const id of ids) {
    let missed = 0;
    let games = 0;
    for (const pool of pools) {
      // Missing from a season: a rookie, or out of the league; no evidence
      const played = pool.byName.get(names[id]);
      if (played === undefined) continue;
      missed += Math.max(0, pool.games - played);
      games += pool.games;
    }
    rates[id] = Math.round(((missed + RATE_WEIGHT * USUAL_MISS_RATE) / (games + RATE_WEIGHT)) * 1000) / 1000;
  }
  return rates;
}

export function buildInjuryData({ days, schedule, through, names, proTeams, priors }: InjuryInput): InjuryData {
  const sorted = [...days].sort((a, b) => a.day - b.day).filter((d) => d.day <= through);
  const playing = teamsByDay(schedule);
  const teamOn = nbaTeamOnDay(sorted);
  const proTeam = (id: number, d: InjuryDay) => d.playedFor?.[id] ?? teamOn(id, d.day) ?? proTeams[id];

  const starts = new Map<string, number>();
  const playedCount = new Map<string, number>();
  const rostered = new Set<string>();
  const misses: Miss[] = [];
  const lines = new Map<number, number[]>();
  // Player → his absence so far: first day, and each missed game's team and slot
  const open = new Map<number, { start: number; games: [number, number, number][] }>();
  const close = (id: number) => {
    const spell = open.get(id);
    if (!spell) return;
    for (const [team, day, slot] of spell.games) {
      const kind = slot === IR ? 2 : slot === BENCH ? 1 : 0;
      misses.push(
        kind
          ? [team, id, day, spell.start, spell.games.length, kind]
          : [team, id, day, spell.start, spell.games.length],
      );
    }
    open.delete(id);
  };

  let rosters: Record<string, number[]> = {};
  for (const d of sorted) {
    if (d.rosters) rosters = d.rosters;
    const played = new Set<number>();
    for (const p of d.players) {
      if (p[3] <= 0) continue;
      played.add(p[1]);
      const line = lines.get(p[1]) ?? [0, ...emptyLine()];
      line[0] += p[3];
      for (let i = 0; i < 10; i++) line[i + 1] += p[4 + i] ?? 0;
      lines.set(p[1], line);
    }
    const games = playing.get(d.day);
    const seen = new Set<number>();
    for (const [team, roster] of Object.entries(rosters)) {
      for (const id of roster) {
        seen.add(id);
        const pro = proTeam(id, d);
        const hadGame = played.has(id) || (pro !== undefined && games?.has(pro));
        if (!hadGame) continue;
        const slot = d.slots?.[id];
        const key = `${team}:${id}`;
        rostered.add(key);
        if (isStarter(slot)) {
          starts.set(key, (starts.get(key) ?? 0) + 1);
        }
        if (played.has(id)) {
          playedCount.set(key, (playedCount.get(key) ?? 0) + 1);
          close(id);
          continue;
        }
        const spell = open.get(id) ?? { start: d.day, games: [] };
        spell.games.push([Number(team), d.day, slot ?? BENCH]);
        open.set(id, spell);
      }
    }
    // Off every roster while his team played: nobody saw whether he did,
    // so the absence ends there
    for (const id of [...open.keys()]) {
      if (seen.has(id)) continue;
      const pro = teamOn(id, d.day) ?? proTeams[id];
      if (pro !== undefined && games?.has(pro)) close(id);
    }
  }
  for (const id of [...open.keys()]) close(id);
  misses.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);

  const playersSeen = new Set([...rostered].map((k) => Number(k.split(':')[1])));
  const priorPools = priors.slice(0, 2).map((pool, i) => ({
    weight: i === 0 ? 1 : 0.5,
    byName: new Map((pool?.players ?? []).map((p) => [p[0], p])),
  }));
  const out: Record<string, number[]> = {};
  for (const id of playersSeen) {
    const own = lines.get(id);
    const ownGames = own?.[0] ?? 0;
    if (ownGames >= MIN_LINE_GAMES) {
      out[id] = own!;
      continue;
    }
    const priorLine = emptyLine();
    let priorGames = 0;
    for (const pool of priorPools) {
      const p = pool.byName.get(names[id]);
      if (!p || p[1] <= 0) continue;
      priorGames += pool.weight * p[1];
      for (let i = 0; i < 10; i++) priorLine[i] += pool.weight * ((p[3 + i] as number) ?? 0);
    }
    const pad = Math.min(MIN_LINE_GAMES - ownGames, priorGames);
    if (ownGames + pad <= 0) continue;
    const totalGames = Math.round((ownGames + pad) * 10) / 10;
    const stats = emptyLine().map((_, i) => {
      const o = own ? own[1 + i] : 0;
      const pr = priorGames > 0 ? (priorLine[i] / priorGames) * pad : 0;
      return Math.round((o + pr) * 10) / 10;
    });
    out[id] = [totalGames, ...stats];
  }

  const startEntries: [number, number, number, number?][] = [];
  for (const key of rostered) {
    const s = starts.get(key) ?? 0;
    const p = playedCount.get(key) ?? 0;
    if (s === 0 && p === 0) continue;
    const [team, id] = key.split(':').map(Number);
    startEntries.push([team, id, s, p]);
  }

  return {
    through,
    starts: startEntries,
    misses,
    lines: out,
    rates: missRates(playersSeen, names, priors),
  };
}

export interface PlayerAbsence {
  team: number;
  player: number;
  from: number;
  to: number;
  // Games missed in the active scope (roster or lineup)
  lost: number;
  lineup: number;
  sidelined: number;
  // Every NBA game the absence ran while rostered
  length: number;
  keptIn: number;
  points: number;
}

export interface PlayerInjury {
  team: number;
  player: number;
  // Auction price if drafted by this team
  price?: number;
  // Games played on this team (starter + bench) and in the starting lineup
  played: number;
  startPlayed: number;
  // Total counted opportunities (played + lost in active scope)
  starts: number;
  // Total games missed in the active scope
  lost: number;
  lineup: number;
  sidelined: number;
  ir: number;
  bench: number;
  keptIn: number;
  surprise: number;
  // Roto points per game from his stat line
  perGame: number;
  // Roto points missed in the active scope
  points: number;
  lineupPoints: number;
  sidelinedPoints: number;
  keptInPoints: number;
  surprisePoints: number;
  // Prior two seasons' miss rate (before league scaling)
  usualRate: number;
  expectedGames: number;
  expectedPoints: number;
  // Expected minus actual points missed: below zero is bad luck
  luck: number;
  spells: PlayerAbsence[];
}

export interface WeekPlayerLoss {
  player: number;
  games: number;
  lineup: number;
  sidelined: number;
  points: number;
}

export interface TeamWeekLoss {
  games: number;
  lineup: number;
  sidelined: number;
  points: number;
  players: WeekPlayerLoss[];
}

export interface TeamInjuries {
  id: number;
  // Games played + missed in the active scope
  starts: number;
  played: number;
  lost: number;
  lineup: number;
  sidelined: number;
  ir: number;
  bench: number;
  // Lost while the player was already out when the week's lineup locked
  keptIn: number;
  surprise: number;
  points: number;
  lineupPoints: number;
  sidelinedPoints: number;
  // Points lost to surprises (out after the lineup locked) and to players
  // kept in the lineup though already out
  surprisePoints: number;
  keptInPoints: number;
  // Expected absences, given each player's history, scaled to the league
  expectedGames: number;
  expectedPoints: number;
  // Expected minus actual points lost: below zero is bad luck
  luck: number;
  rank: number;
  healthyRank: number;
  healthyPoints: number;
  rotoPoints: number;
  // Players on this team, sorted by points missed
  players: PlayerInjury[];
  // Games lost each lineup week
  weeks: TeamWeekLoss[];
}

export type Absence = PlayerAbsence;

export interface InjurySummary {
  teams: TeamInjuries[];
  players: PlayerInjury[];
  absences: Absence[];
  weeks: LineupWeek[];
  scope: AbsenceScope;
  multiOnly: boolean;
}

export function summarizeInjuries(
  data: InjuryData,
  league: NbaLeague,
  {
    multiOnly = false,
    scope = 'roster',
  }: { multiOnly?: boolean; scope?: AbsenceScope } = {},
): InjurySummary {
  const rates = pointRates(league);
  const perGame = new Map<number, StatLine>();
  const value = new Map<number, number>();
  for (const [id, [games, ...totals]] of Object.entries(data.lines)) {
    const line = totals.map((v) => (games ? v / games : 0));
    perGame.set(Number(id), line);
    value.set(Number(id), Math.max(0, linePoints(line, rates)));
  }

  // Replacement starter line (~120th–150th rostered player) for sidelined
  // bench/IR games in the healthy standings simulation
  const sortedLines = [...perGame.entries()]
    .sort((a, b) => (value.get(b[0]) ?? 0) - (value.get(a[0]) ?? 0))
    .map(([, line]) => line);
  const repSlice = sortedLines.slice(110, 150);
  const replacementLine = emptyLine();
  if (repSlice.length > 0) {
    for (const l of repSlice) for (let i = 0; i < 10; i++) replacementLine[i] += l[i] / repSlice.length;
  }
  const replacementValue = linePoints(replacementLine, rates);

  const weeks = lineupWeeks(league.opener, league.finalDay).filter((w) => w.first <= data.through);
  const weekOf = (day: number) => weeks.findIndex((w) => day >= w.first && day <= w.last);

  const draftPrice = new Map<string, number>();
  for (const pick of league.draft ?? []) {
    draftPrice.set(`${pick.team}:${pick.playerID}`, pick.price);
  }

  // Raw starter misses per (team, player) to recover startPlayed when older
  // data.starts entries lack the 4th element
  const allStarterMisses = new Map<string, number>();
  for (const [teamID, id, , , , kind = 0] of data.misses) {
    if (kind === 0) {
      const k = `${teamID}:${id}`;
      allStarterMisses.set(k, (allStarterMisses.get(k) ?? 0) + 1);
    }
  }

  const byTeamPlayer = new Map<string, PlayerInjury>();
  const ensurePlayer = (teamID: number, id: number): PlayerInjury => {
    const key = `${teamID}:${id}`;
    let p = byTeamPlayer.get(key);
    if (!p) {
      p = {
        team: teamID,
        player: id,
        price: draftPrice.get(key),
        played: 0,
        startPlayed: 0,
        starts: 0,
        lost: 0,
        lineup: 0,
        sidelined: 0,
        ir: 0,
        bench: 0,
        keptIn: 0,
        surprise: 0,
        perGame: value.get(id) ?? 0,
        points: 0,
        lineupPoints: 0,
        sidelinedPoints: 0,
        keptInPoints: 0,
        surprisePoints: 0,
        usualRate: data.rates[id] ?? USUAL_MISS_RATE,
        expectedGames: 0,
        expectedPoints: 0,
        luck: 0,
        spells: [],
      };
      byTeamPlayer.set(key, p);
    }
    return p;
  };

  for (const [teamID, id, startGames, playedGames] of data.starts) {
    if (!league.teams.some((t) => t.id === teamID)) continue;
    const key = `${teamID}:${id}`;
    const startPlayed = Math.max(0, startGames - (allStarterMisses.get(key) ?? 0));
    const played = playedGames ?? startPlayed;
    if (scope === 'lineup' && startGames === 0) continue;
    const p = ensurePlayer(teamID, id);
    p.startPlayed = startPlayed;
    p.played = scope === 'lineup' ? startPlayed : played;
  }

  const teams = new Map<number, TeamInjuries>(
    league.teams.map((t) => [
      t.id,
      {
        id: t.id,
        starts: 0,
        played: 0,
        lost: 0,
        lineup: 0,
        sidelined: 0,
        ir: 0,
        bench: 0,
        keptIn: 0,
        surprise: 0,
        points: 0,
        lineupPoints: 0,
        sidelinedPoints: 0,
        surprisePoints: 0,
        keptInPoints: 0,
        expectedGames: 0,
        expectedPoints: 0,
        luck: 0,
        rank: 0,
        healthyRank: 0,
        healthyPoints: 0,
        rotoPoints: 0,
        players: [],
        weeks: weeks.map(() => ({ games: 0, lineup: 0, sidelined: 0, points: 0, players: [] })),
      },
    ]),
  );
  const healthy = new Map(league.teams.map((t) => [t.id, [...t.totals]]));
  const absences = new Map<string, PlayerAbsence>();
  const weekPlayerMap = new Map<string, WeekPlayerLoss>();

  for (const [teamID, id, day, start, length, kind = 0] of data.misses) {
    if (multiOnly && length < 2) continue;
    if (scope === 'lineup' && kind !== 0) continue;
    const team = teams.get(teamID);
    if (!team) continue;
    const key = `${teamID}:${id}`;
    const existing = byTeamPlayer.get(key);
    // Skip pure unplayed $0–$4 stashes who never played or started a game for this team
    if (!existing && (draftPrice.get(key) ?? 0) < MIN_STASH_PRICE) continue;
    const p = existing ?? ensurePlayer(teamID, id);

    const week = weekOf(day);
    const isLineup = kind === 0;
    const keptIn = isLineup && week >= 0 && start < weeks[week].first ? 1 : 0;
    const surprise = isLineup && !keptIn ? 1 : 0;
    const pts = value.get(id) ?? 0;

    p.lost++;
    p.points += pts;
    if (isLineup) {
      p.lineup++;
      p.lineupPoints += pts;
      p.keptIn += keptIn;
      p.surprise += surprise;
      if (keptIn) p.keptInPoints += pts;
      else p.surprisePoints += pts;
    } else {
      p.sidelined++;
      p.sidelinedPoints += pts;
      if (kind === 2) p.ir++;
      else p.bench++;
    }

    if (week >= 0) {
      const w = team.weeks[week];
      w.games++;
      if (isLineup) w.lineup++;
      else w.sidelined++;
      w.points += pts;
      const wkKey = `${teamID}:${week}:${id}`;
      let wp = weekPlayerMap.get(wkKey);
      if (!wp) {
        wp = { player: id, games: 0, lineup: 0, sidelined: 0, points: 0 };
        weekPlayerMap.set(wkKey, wp);
        w.players.push(wp);
      }
      wp.games++;
      if (isLineup) wp.lineup++;
      else wp.sidelined++;
      wp.points += pts;
    }

    const line = perGame.get(id);
    if (line) {
      if (isLineup) {
        addLine(healthy.get(teamID)!, line);
      } else if (pts > replacementValue) {
        addLine(
          healthy.get(teamID)!,
          line.map((v, i) => Math.max(0, v - replacementLine[i])),
        );
      }
    }

    const spellKey = `${teamID}:${id}:${start}`;
    let a = absences.get(spellKey);
    if (!a) {
      a = {
        team: teamID,
        player: id,
        from: day,
        to: day,
        lost: 0,
        lineup: 0,
        sidelined: 0,
        length,
        keptIn: 0,
        points: 0,
      };
      absences.set(spellKey, a);
      p.spells.push(a);
    }
    a.to = day;
    a.lost++;
    if (isLineup) a.lineup++;
    else a.sidelined++;
    a.keptIn += keptIn;
    a.points += pts;
  }

  // Expected: each player missing his usual share over his counted games on
  // the roster, scaled so the league as a whole expects the absences it had.
  let rawExpectedGames = 0;
  let totalLuckMissed = 0;
  for (const p of byTeamPlayer.values()) {
    const luckMissed = scope === 'lineup' ? p.surprise : p.lost;
    const opp = p.played + luckMissed;
    p.starts = p.played + p.lost;
    p.expectedGames = opp * p.usualRate;
    rawExpectedGames += p.expectedGames;
    totalLuckMissed += luckMissed;
  }
  const scale = rawExpectedGames ? totalLuckMissed / rawExpectedGames : 0;

  for (const p of byTeamPlayer.values()) {
    p.expectedGames *= scale;
    p.expectedPoints = p.expectedGames * p.perGame;
    const actualLuckPoints = scope === 'lineup' ? p.surprisePoints : p.points;
    p.luck = p.expectedPoints - actualLuckPoints;
    p.spells.sort((a, b) => a.from - b.from);

    const team = teams.get(p.team);
    if (!team) continue;
    team.starts += p.starts;
    team.played += p.played;
    team.lost += p.lost;
    team.lineup += p.lineup;
    team.sidelined += p.sidelined;
    team.ir += p.ir;
    team.bench += p.bench;
    team.keptIn += p.keptIn;
    team.surprise += p.surprise;
    team.points += p.points;
    team.lineupPoints += p.lineupPoints;
    team.sidelinedPoints += p.sidelinedPoints;
    team.keptInPoints += p.keptInPoints;
    team.surprisePoints += p.surprisePoints;
    team.expectedGames += p.expectedGames;
    team.expectedPoints += p.expectedPoints;
    team.luck += p.luck;
    team.players.push(p);
  }

  for (const t of teams.values()) {
    t.players.sort((a, b) => b.points - a.points || a.luck - b.luck || b.played - a.played);
    for (const w of t.weeks) {
      w.players.sort((a, b) => b.points - a.points || b.games - a.games);
    }
  }

  const actual = scoreRoto(new Map(league.teams.map((t) => [t.id, t.totals])));
  const whole = scoreRoto(healthy);
  actual.forEach((r, i) => {
    const t = teams.get(r.id)!;
    t.rank = i + 1;
    t.rotoPoints = r.points;
  });
  whole.forEach((r, i) => {
    const t = teams.get(r.id)!;
    t.healthyRank = i + 1;
    t.healthyPoints = r.points;
  });

  return {
    teams: [...teams.values()],
    players: [...byTeamPlayer.values()].filter((p) => p.lost > 0).sort((a, b) => b.points - a.points || b.lost - a.lost),
    absences: [...absences.values()].sort((a, b) => b.points - a.points || b.lost - a.lost),
    weeks,
    scope,
    multiOnly,
  };
}
