// Split a score into whole and decimal parts so the decimals can be dimmed,
// matching how the standings render points.
export function splitScore(
  score: string | number,
  digits = 2,
): { int: string; dec: string } {
  const [int, dec = ''] = (Number(score) || 0).toFixed(digits).split('.');
  return { int, dec };
}
