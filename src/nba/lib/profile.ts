import { CATEGORIES } from './roto.ts';

// A team's shape across the eight categories: where it ranked in each, 0 for
// last up to 1 for first, and what that says about how it was built.

// Around the octagon, clockwise from the top: scoring, then the guard stats
// down the right side and the big-man stats up the left, so a build shows as a
// lean to one side
const indexes = (keys: string[]) => keys.map((k) => CATEGORIES.findIndex((c) => c.key === k));

export const AXES = indexes(['pts', 'tpm', 'ftp', 'ast', 'stl', 'blk', 'reb', 'fgp']);

const GUARD = indexes(['tpm', 'ftp', 'ast', 'stl']);
const BIG = indexes(['blk', 'reb', 'fgp']);

// A build leans when one side outranks the other by this much on average
const LEAN = 0.2;
// A punt is a bottom-two finish in a category while the rest average at least
// mid-table: given up, not just bad
export const PUNT_REST = 0.5;

export type Build = 'guards' | 'bigs' | 'balanced';

export interface Profile {
  // Per category, in CATEGORIES order: 0 for last up to 1 for first
  shape: number[];
  build: Build;
  punts: number[];
  strengths: number[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function buildProfile(points: number[], teamCount: number): Profile {
  const shape = points.map((p) => (teamCount > 1 ? (p - 1) / (teamCount - 1) : 0.5));
  const lean = mean(GUARD.map((i) => shape[i])) - mean(BIG.map((i) => shape[i]));
  const bottomTwo = 1 / (teamCount - 1) + 1e-9;
  const punts = shape.flatMap((s, i) => {
    if (s > bottomTwo) return [];
    const rest = mean(shape.filter((_, j) => j !== i));
    return rest >= PUNT_REST ? [i] : [];
  });
  // Top three in a category
  const topThree = (teamCount - 3) / (teamCount - 1) - 1e-9;
  const strengths = shape
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s >= topThree)
    .sort((a, b) => b.s - a.s)
    .map(({ i }) => i);
  return {
    shape,
    build: lean > LEAN ? 'guards' : lean < -LEAN ? 'bigs' : 'balanced',
    punts,
    strengths,
  };
}

export const BUILD_LABEL: Record<Build, string> = {
  guards: 'Guard build',
  bigs: 'Big-man build',
  balanced: 'Balanced',
};
