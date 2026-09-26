// Positions that share a lineup slot are valued together. The leagues roster
// team kickers (TMPK) rather than individual ones.
const POSITION_GROUPS = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  TMPK: 'K',
  DE: 'DL',
  DT: 'DL',
  LB: 'LB',
  CB: 'DB',
  S: 'DB',
};

const round = (value, places = 2) =>
  Math.round(value * 10 ** places) / 10 ** places;

// What each pick's season so far is worth at auction, in the league's own
// dollars. Roughly: what he'd go for in a redo of the draft where everyone
// knew how the season would go.
//
// 1. Baseline. At each position, the points of the player ranked just past
//    the number the league drafted there. Madison took 20 QBs, so a QB's
//    baseline is the 21st-best QB's season: about what a team could have had
//    for nothing.
// 2. Price of a point. Every roster spot costs at least $1, so the money bid
//    on talent is what the league spent less $1 a pick. Spread over the
//    points the drafted players have scored above their baselines, that
//    gives a price per point, nudged up to cover the picks that fell short
//    of their $1. Undrafted breakouts don't take a share, so the picks' worth
//    adds up to what was spent and values net to zero across the league.
// 3. Worth. $1, plus that price for every point above the baseline, and
//    never below $0. A pick's value is his worth less what was paid.
//
// `positionOf` gives the MFL position of any player ID. `scores` holds every
// player's points, drafted or not, since undrafted players set the baseline.
export default function valueDraft({ picks, scores, positionOf }) {
  const groupOf = (id) => {
    const position = positionOf(id);
    return POSITION_GROUPS[position] ?? position;
  };

  const drafted = new Map();
  picks.forEach(({ player }) => {
    const group = groupOf(player);
    drafted.set(group, (drafted.get(group) ?? 0) + 1);
  });

  // Every season at the drafted positions, best first
  const seasons = new Map([...drafted.keys()].map((group) => [group, []]));
  scores.forEach((points, id) => seasons.get(groupOf(id))?.push(points));

  const baselines = new Map();
  drafted.forEach((count, group) => {
    const ranked = seasons.get(group).sort((a, b) => b - a);
    baselines.set(group, ranked[count] ?? 0);
  });

  const aboveBaseline = picks.map(
    ({ player }) => (scores.get(player) ?? 0) - baselines.get(groupOf(player)),
  );
  const pointsAboveBaseline = aboveBaseline.reduce(
    (sum, points) => sum + Math.max(0, points),
    0,
  );
  const worthAt = (points, price) => Math.max(0, 1 + points * price);
  const totalWorthAt = (price) =>
    aboveBaseline.reduce((sum, points) => sum + worthAt(points, price), 0);

  const spent = picks.reduce((sum, pick) => sum + pick.price, 0);
  // Nothing to value until someone has scored
  let pointPrice = null;
  if (pointsAboveBaseline > 0) {
    // Picks below their baseline fall short of their $1, so the plain split
    // leaves the league's worth under what it spent. Nudge the price up until
    // the picks' worth adds up to exactly the spend: the plain split lands at
    // or under it, and paying the whole spend per point lands over it.
    let low = (spent - picks.length) / pointsAboveBaseline;
    let high = spent / pointsAboveBaseline;
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      if (totalWorthAt(mid) < spent) low = mid;
      else high = mid;
    }
    pointPrice = (low + high) / 2;
  }

  return {
    spent,
    pointPrice: pointPrice === null ? null : round(pointPrice, 4),
    baselines: [...drafted.entries()].map(([group, count]) => ({
      position: group,
      drafted: count,
      points: round(baselines.get(group)),
    })),
    picks: picks.map((pick, i) => ({
      ...pick,
      points: round(scores.get(pick.player) ?? 0),
      worth:
        pointPrice === null
          ? null
          : round(worthAt(aboveBaseline[i], pointPrice)),
    })),
  };
}
