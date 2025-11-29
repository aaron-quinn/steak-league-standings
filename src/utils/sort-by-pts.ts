import type { TeamForPlayoff } from '../types/TeamForPlayoff';

export default function sortByPts(
  a: TeamForPlayoff,
  b: TeamForPlayoff,
): number {
  return +b.points - +a.points;
}
