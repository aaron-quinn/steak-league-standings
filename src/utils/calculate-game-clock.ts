export function getNflQuarterAndTime(secondsRemaining: number): {
  quarter: string;
  quarterTime: string;
} {
  const QUARTER_LENGTH = 15 * 60; // 15 minutes per quarter in seconds
  const TOTAL_QUARTERS = 4;

  // Clamp to 0 if negative
  secondsRemaining = Math.max(0, secondsRemaining);
  // Calculate current quarter (1-based)
  let quarter = TOTAL_QUARTERS - Math.floor(secondsRemaining / QUARTER_LENGTH);
  if (quarter > TOTAL_QUARTERS) quarter = TOTAL_QUARTERS;
  if (quarter < 1) quarter = 1;

  // Add ordinal suffix
  function getOrdinal(n: number): string {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
  }

  // Seconds left in current quarter
  const secondsIntoQuarter = secondsRemaining % QUARTER_LENGTH;
  const minutes = Math.floor(secondsIntoQuarter / 60);
  const seconds = secondsIntoQuarter % 60;

  // Format as mm:ss
  const quarterTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return { quarter: `${quarter}${getOrdinal(quarter)}`, quarterTime };
}
