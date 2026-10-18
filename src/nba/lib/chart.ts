// A label at each new month along a weekly x axis, dropping one that would
// crowd the label before it (a season that opens late in a month)
export function monthTicks(dates: Date[], x: (i: number) => number, minGap = 26) {
  const ticks: { i: number; label: string }[] = [];
  dates.forEach((date, i) => {
    if (i > 0 && date.getUTCMonth() === dates[i - 1].getUTCMonth()) return;
    const previous = ticks[ticks.length - 1];
    if (previous && x(i) - x(previous.i) < minGap) ticks.pop();
    ticks.push({
      i,
      label: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    });
  });
  return ticks;
}
