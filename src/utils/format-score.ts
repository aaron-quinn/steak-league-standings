// Split a score into whole and decimal parts so the decimals can be dimmed,
// matching how the standings render points.
export function splitScore(
  score: string | number,
  digits = 2,
): { int: string; dec: string } {
  const [int, dec = ''] = (Number(score) || 0).toFixed(digits).split('.');
  return { int, dec };
}

export const ordinal = (n: number) => {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
        'th');
  return `${n}${suffix}`;
};

// Whole percents, without claiming a certainty the simulation can't show
export function formatChance(chance: number, settled: boolean) {
  if (!settled && chance > 0.995) return '>99%';
  if (!settled && chance < 0.005) return '<1%';
  return `${Math.round(chance * 100)}%`;
}
