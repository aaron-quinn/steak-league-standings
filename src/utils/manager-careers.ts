import getManagers from '@/data/managers';
import type { StandingsData } from '@/types/StandingsData';
import type { WeeklyScores } from '@/types/Fun';
import { buildSteakSeason } from './steak-season';
import { getSteakZone, type SteakZone } from './steak-teams';

// One manager across every season in the managers data, built from each
// season's weekly scores (steak rank, points) and standings (record)

export interface CareerSeason {
  year: number;
  // Franchise ID, e.g. "madison0002"
  id: string;
  league: string;
  division: string;
  champion: boolean;
  // In the steak pool that year (before 2021 only some LA teams were)
  inPool: boolean;
  // Official steak rank among the pool after the last played week
  rank: number | null;
  poolSize: number;
  zone: SteakZone | null;
  // The recorded result for a finished season; null while it's being played
  ate: boolean | null;
  finished: boolean;
  weeksPlayed: number;
  points: number;
  record: { wins: number; losses: number; ties: number } | null;
  bestWeek: { week: number; score: number } | null;
}

export interface Career {
  name: string;
  slug: string;
  // Newest first
  seasons: CareerSeason[];
  ate: number;
  bought: number;
  titles: number;
  // 1 for first in the pool, 0 for last, averaged over finished pool seasons
  averageFinish: number | null;
  bestWeek: { year: number; week: number; score: number } | null;
}

export const managerSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function buildCareers(
  currentYear: number,
  scoresByYear: Map<number, WeeklyScores[]>,
  standingsByYear: Map<number, StandingsData>,
): Career[] {
  const seasons = new Map(
    [...scoresByYear].map(([year, scores]) => [
      year,
      buildSteakSeason(year, scores),
    ]),
  );

  return getManagers()
    .map((manager) => {
      const careerSeasons: CareerSeason[] = Object.entries(manager.teams)
        .map(([yearKey, team]) => ({ year: Number(yearKey), team }))
        // A steak result without a team has no scores to show
        .filter(({ year, team }) => team.teamID && seasons.has(year))
        .map(({ year, team }) => {
          const season = seasons.get(year)!;
          const scores = scoresByYear.get(year)!;
          const id = `${(team.league ?? '').toLowerCase()}${team.teamID}`;
          const raceTeam = season.teams.find((t) => t.id === id);
          const rank = raceTeam?.ranks[raceTeam.ranks.length - 1] ?? null;
          const poolSize = season.teams.length;
          const weekly = scores.map(({ week, scores: s }) => ({
            week,
            score: s[id] ?? 0,
          }));
          const best = weekly.reduce<CareerSeason['bestWeek']>(
            (top, w) => (w.score > (top?.score ?? -Infinity) ? w : top),
            null,
          );
          const standing = standingsByYear.get(year)?.[id];
          const finished = year < currentYear;
          return {
            year,
            id,
            league: team.league ?? '',
            division: team.division ?? '',
            champion: !!team.champion,
            inPool: 'steak' in team,
            rank,
            poolSize,
            zone: rank ? getSteakZone(rank, poolSize) : null,
            ate: finished && 'steak' in team ? !!team.steak : null,
            finished,
            weeksPlayed: scores.length,
            points: weekly.reduce((sum, w) => sum + w.score, 0),
            record: standing
              ? {
                  wins: standing.wins,
                  losses: standing.losses,
                  ties: standing.ties,
                }
              : null,
            bestWeek: best && best.score > 0 ? best : null,
          };
        })
        // Leave out a season that hasn't kicked off
        .filter((s) => s.weeksPlayed > 0)
        .sort((a, b) => b.year - a.year);

      const pooled = careerSeasons.filter(
        (s) => s.finished && s.inPool && s.rank,
      );
      const bestWeek = careerSeasons.reduce<Career['bestWeek']>(
        (top, s) =>
          s.bestWeek && s.bestWeek.score > (top?.score ?? -Infinity)
            ? { year: s.year, ...s.bestWeek }
            : top,
        null,
      );
      return {
        name: manager.name,
        slug: managerSlug(manager.name),
        seasons: careerSeasons,
        ate: careerSeasons.filter((s) => s.ate === true).length,
        bought: careerSeasons.filter((s) => s.ate === false).length,
        titles: careerSeasons.filter((s) => s.champion).length,
        averageFinish: pooled.length
          ? pooled.reduce(
              (sum, s) => sum + 1 - (s.rank! - 1) / (s.poolSize - 1),
              0,
            ) / pooled.length
          : null,
        bestWeek,
      };
    })
    .filter((career) => career.seasons.length > 0)
    .sort(
      (a, b) =>
        b.ate - a.ate ||
        a.bought - b.bought ||
        b.titles - a.titles ||
        a.name.localeCompare(b.name),
    );
}
