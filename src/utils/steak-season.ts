import type { WeeklyScores } from '@/types/Fun';
import { getSteakLine, getTeamManagers, rankSteakTeams } from './steak-teams';

export interface RaceTeam {
  id: string;
  name: string;
  // Last name, or more when two teams share one
  shortName: string;
  // Running points total and official steak rank after each played week
  totals: number[];
  ranks: number[];
  weekly: number[];
}

export interface SteakSeason {
  weeks: number[];
  teams: RaceTeam[];
}

function shortNames(names: string[]): Map<string, string> {
  const last = (name: string) => name.split(' ').slice(1).join(' ') || name;
  const counts = new Map<string, number>();
  names.forEach((name) =>
    counts.set(last(name), (counts.get(last(name)) ?? 0) + 1),
  );
  return new Map(
    names.map((name) => [
      name,
      (counts.get(last(name)) ?? 0) > 1
        ? `${name[0]}. ${last(name)}`
        : last(name),
    ]),
  );
}

// The steak race over a season: every steak team's running total and rank
// after each played week
export function buildSteakSeason(
  year: number,
  weeklyScores: WeeklyScores[],
): SteakSeason {
  const steakTeams = [...getTeamManagers(year).values()].filter(
    (team) => team.steak,
  );
  const names = shortNames(steakTeams.map((team) => team.name));
  const teams: RaceTeam[] = steakTeams.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: names.get(team.name) ?? team.name,
    totals: [],
    ranks: [],
    weekly: [],
  }));

  const running = new Map<string, number>();
  weeklyScores.forEach(({ scores }) => {
    teams.forEach((team) => {
      const score = scores[team.id] ?? 0;
      running.set(team.id, (running.get(team.id) ?? 0) + score);
      team.weekly.push(score);
      team.totals.push(running.get(team.id) ?? 0);
    });
    const ranks = rankSteakTeams(steakTeams, (id) => running.get(id) ?? 0);
    teams.forEach((team) => team.ranks.push(ranks.get(team.id) ?? 0));
  });

  return { weeks: weeklyScores.map(({ week }) => week), teams };
}

export interface SeasonFact {
  label: string;
  value: string;
  detail: string;
  teamID?: string;
}

// Headline moments from a season, for the cards under the chart
export function getSeasonFacts(season: SteakSeason): SeasonFact[] {
  const { weeks, teams } = season;
  if (weeks.length === 0) return [];
  const facts: SeasonFact[] = [];
  const eaterCount = getSteakLine(teams.length).eaters;

  if (weeks.length > 1) {
    let climb = { team: teams[0], week: 0, delta: 0 };
    let fall = { team: teams[0], week: 0, delta: 0 };
    teams.forEach((team) => {
      for (let i = 1; i < weeks.length; i++) {
        const delta = team.ranks[i - 1] - team.ranks[i];
        if (delta > climb.delta) climb = { team, week: weeks[i], delta };
        if (delta < fall.delta) fall = { team, week: weeks[i], delta };
      }
    });
    if (climb.delta > 0) {
      facts.push({
        label: 'Biggest climb',
        value: `▲ ${climb.delta}`,
        detail: `${climb.team.name}, week ${climb.week}`,
        teamID: climb.team.id,
      });
    }
    if (fall.delta < 0) {
      facts.push({
        label: 'Biggest drop',
        value: `▼ ${-fall.delta}`,
        detail: `${fall.team.name}, week ${fall.week}`,
        teamID: fall.team.id,
      });
    }
  }

  const weeksAtTop = teams
    .map((team) => ({ team, count: team.ranks.filter((r) => r === 1).length }))
    .sort((a, b) => b.count - a.count)[0];
  facts.push({
    label: 'Most weeks at #1',
    value: `${weeksAtTop.count}`,
    detail: weeksAtTop.team.name,
    teamID: weeksAtTop.team.id,
  });

  // Moving between eating and buying (the self-buyer counts as buying)
  const crossings = teams
    .map((team) => ({
      team,
      count: team.ranks.filter(
        (rank, i) =>
          i > 0 && rank <= eaterCount !== team.ranks[i - 1] <= eaterCount,
      ).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  if (crossings.count > 0) {
    facts.push({
      label: 'Steak line crossings',
      value: `${crossings.count}`,
      detail: crossings.team.name,
      teamID: crossings.team.id,
    });
  }

  const bestWeek = teams
    .flatMap((team) =>
      team.weekly.map((score, i) => ({ team, score, week: weeks[i] })),
    )
    .sort((a, b) => b.score - a.score)[0];
  facts.push({
    label: 'Best week',
    value: bestWeek.score.toFixed(2),
    detail: `${bestWeek.team.name}, week ${bestWeek.week}`,
    teamID: bestWeek.team.id,
  });

  return facts;
}
