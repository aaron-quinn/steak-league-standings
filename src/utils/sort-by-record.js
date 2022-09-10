export default function sortByRecord(a, b) {
  const { wins: winsA, ties: tiesA } = a;
  const { wins: winsB, ties: tiesB } = b;

  let totalA = +winsA + 0.5 * +tiesA;
  let totalB = +winsB + 0.5 * +tiesB;

  if (totalB === totalA) {
    return +b.points - +a.points;
  }

  return totalB - totalA;
}
