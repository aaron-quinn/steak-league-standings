export const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

// Roto points come in halves when teams tie
export const formatPoints = (points: number) =>
  Number.isInteger(points) ? String(points) : points.toFixed(1);

export const plural = (n: number, word: string, words = `${word}s`) =>
  `${formatPoints(n)} ${n === 1 ? word : words}`;
