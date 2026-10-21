// The NBA schedule, and which NBA team a player was with on a given day.
// Self-contained (no imports) so scripts can load it straight into Node.

// { [NBA team id]: scoring periods (days) it plays }, from ESPN's
// proTeamSchedules_wl view (worker/nba/espn.js compactSchedule)
export type NbaSchedule = Record<string, number[]>;

// Day → the NBA teams with a game that day
export function teamsByDay(schedule: NbaSchedule) {
  const byDay = new Map<number, Set<number>>();
  for (const [team, days] of Object.entries(schedule)) {
    for (const day of days) {
      let teams = byDay.get(day);
      if (!teams) byDay.set(day, (teams = new Set()));
      teams.add(Number(team));
    }
  }
  return byDay;
}

// Each player's NBA team on any day, from the days he played: the team he last
// played for on or before it, else the first he played for after. A past
// day's ESPN snapshot only has his team as of when it was fetched, which is
// wrong for anyone traded since.
export function nbaTeamOnDay(
  days: { day: number; playedFor?: Record<string, number> }[],
) {
  const games = new Map<string, [number, number][]>();
  for (const d of [...days].sort((a, b) => a.day - b.day)) {
    for (const [id, team] of Object.entries(d.playedFor ?? {})) {
      if (!games.has(id)) games.set(id, []);
      games.get(id)!.push([d.day, team]);
    }
  }
  return (id: string | number, day: number) => {
    const list = games.get(String(id));
    if (!list) return undefined;
    let team = list[0][1];
    for (const [d, t] of list) {
      if (d > day) break;
      team = t;
    }
    return team;
  };
}
