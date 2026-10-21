// A lineup week's games, team by team. Lineups are weekly: each starter locks
// at his first game of the week (Monday to Sunday; week one runs from opening
// night), so a team's games that week are its starters' NBA schedules, minus
// the ones they sat out.
import type { NbaDay, NbaGame } from './data';
import { dateOfDay } from './season.ts';
import { nbaTeamOnDay, teamsByDay, type NbaSchedule } from './schedule.ts';

// Lineup slots that don't count (worker/nba/config.js)
const BENCH = 12;
const IR = 13;

export interface LineupWeek {
  index: number; // 1 for the opening week
  first: number;
  last: number;
}

// Every lineup week of a season: each ends on a Sunday (or the final day)
export function lineupWeeks(opener: string, finalDay: number): LineupWeek[] {
  const weeks: LineupWeek[] = [];
  let first = 1;
  for (let day = 1; day <= finalDay; day++) {
    if (dateOfDay(opener, day).getUTCDay() === 0 || day === finalDay) {
      weeks.push({ index: weeks.length + 1, first, last: day });
      first = day + 1;
    }
  }
  return weeks;
}

// played: he played. live: his game is on now. lost: his game is over and he
// didn't play (injury, rest, coach's call). upcoming: still to come. off: in
// the lineup but no game. out: not in the lineup that day.
export type Cell = 'played' | 'live' | 'lost' | 'upcoming' | 'off' | 'out';

export interface WeekStarter {
  id: number;
  name: string;
  proTeam?: number;
  // One per day of the week
  cells: Cell[];
}

export interface WeekTeam {
  id: number;
  starters: WeekStarter[];
  scheduled: number;
  played: number;
  live: number;
  lost: number;
  upcoming: number;
}

export interface WeekInput {
  week: LineupWeek;
  // The live season's days so far (lineups, player lines, teams played for)
  days: NbaDay[];
  latestDay: number;
  schedule: NbaSchedule;
  names: Record<string, string>;
  // Each player's current NBA team
  proTeams: Record<string, number>;
  // The latest day's NBA games and their state
  today?: { day: number; games: NbaGame[] };
}

export function weekGames({ week, days, latestDay, schedule, names, proTeams, today }: WeekInput) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const current = byDay.get(latestDay);
  const playingOn = teamsByDay(schedule);
  const teamOn = nbaTeamOnDay(days);
  const state = new Map<number, NbaGame['state']>();
  if (today?.day === latestDay) {
    for (const g of today.games) {
      state.set(g.home, g.state);
      state.set(g.away, g.state);
    }
  }
  const dayList: number[] = [];
  for (let d = week.first; d <= week.last; d++) dayList.push(d);

  // team → player → cells
  const grid = new Map<number, Map<number, Cell[]>>();
  dayList.forEach((day, i) => {
    // Days to come use today's lineup: it can still change before each
    // player's first game, but this is the best guess
    const lineup = day <= latestDay ? byDay.get(day) : current;
    if (!lineup?.rosters || !lineup.slots) return;
    const played = new Set(day <= latestDay ? lineup.players.filter((p) => p[3] > 0).map((p) => p[1]) : []);
    const playing = playingOn.get(day);
    for (const [team, roster] of Object.entries(lineup.rosters)) {
      const teamID = Number(team);
      if (!grid.has(teamID)) grid.set(teamID, new Map());
      const players = grid.get(teamID)!;
      for (const id of roster) {
        const slot = lineup.slots[id];
        if (slot === undefined || slot === BENCH || slot === IR) continue;
        if (!players.has(id)) players.set(id, dayList.map(() => 'out'));
        // A trade changes his remaining schedule immediately, even if he
        // hasn't made an appearance for his new NBA team yet.
        const pro = day >= latestDay
          ? proTeams[id] ?? teamOn(id, day)
          : lineup.playedFor?.[id] ?? teamOn(id, day) ?? proTeams[id];
        let cell: Cell = 'off';
        if (played.has(id)) {
          // An actual appearance is authoritative if the schedule feed lags.
          cell = day === latestDay && pro !== undefined && state.get(pro) === 'in' ? 'live' : 'played';
        } else if (pro !== undefined && playing?.has(pro)) {
          if (day > latestDay) cell = 'upcoming';
          else if (day < latestDay) cell = 'lost';
          else {
            const s = state.get(pro);
            cell = s === 'post' ? 'lost' : s === 'in' ? 'live' : 'upcoming';
          }
        }
        players.get(id)![i] = cell;
      }
    }
  });

  const teams = new Map<number, WeekTeam>();
  for (const [id, players] of grid) {
    const team: WeekTeam = { id, starters: [], scheduled: 0, played: 0, live: 0, lost: 0, upcoming: 0 };
    for (const [player, cells] of players) {
      for (const c of cells) {
        if (c === 'played' || c === 'live' || c === 'lost' || c === 'upcoming') {
          team[c]++;
          team.scheduled++;
        }
      }
      team.starters.push({ id: player, name: names[player] ?? `Player ${player}`, proTeam: proTeams[player], cells });
    }
    // Most games first, then by name
    const games = (s: WeekStarter) => s.cells.filter((c) => c !== 'off' && c !== 'out').length;
    team.starters.sort((a, b) => games(b) - games(a) || a.name.localeCompare(b.name));
    teams.set(id, team);
  }
  return { days: dayList, teams };
}
