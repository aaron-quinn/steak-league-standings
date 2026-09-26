import type { WaiverPickup, WaiverSeason } from '@/types/Fun';
import type { MatchupManager } from '@/types/MatchupManager';

// A bid this big should have bought something
const MONEY_PIT_MIN_COST = 10;
// ...and returned less than this
const MONEY_PIT_MAX_POINTS_PER_DOLLAR = 1;
// Weeks a pickup needs on the books before it can be called a flop
const MONEY_PIT_MIN_WEEKS = 2;
// Picked up this many times before he counts as a hot potato
const HOT_POTATO_MIN_PICKUPS = 3;

export const pickupKey = (pickup: WaiverPickup) =>
  `${pickup.franchiseID}:${pickup.player.id}:${pickup.time}`;

export type WaiverSort = 'points' | 'value' | 'price';

// Points per dollar of a paid pickup. A free one has no price to divide by.
export const pointsPerDollar = (pickup: WaiverPickup) =>
  pickup.cost > 0 ? pickup.points / pickup.cost : 0;

export function sortPickups(pickups: WaiverPickup[], sort: WaiverSort) {
  const byPoints = (a: WaiverPickup, b: WaiverPickup) =>
    b.points - a.points || b.started - a.started;
  if (sort === 'value') {
    return pickups
      .filter((p) => p.cost > 0)
      .sort(
        (a, b) => pointsPerDollar(b) - pointsPerDollar(a) || byPoints(a, b),
      );
  }
  if (sort === 'price') {
    return pickups
      .filter((p) => p.cost > 0)
      .sort((a, b) => b.cost - a.cost || byPoints(a, b));
  }
  return [...pickups].sort(byPoints);
}

// A player's best pickup by the chosen sort, with every other time he was
// picked up
export interface PickupGroup {
  lead: WaiverPickup;
  others: WaiverPickup[];
}

// One entry per player, in the order of each one's best pickup. Points from
// different teams aren't added together: no single team had them all.
export function groupByPlayer(
  sorted: WaiverPickup[],
  all: WaiverPickup[],
): PickupGroup[] {
  const groups = new Map<string, PickupGroup>();
  sorted.forEach((pickup) => {
    if (!groups.has(pickup.player.id)) {
      groups.set(pickup.player.id, { lead: pickup, others: [] });
    }
  });
  // Every other pickup, free ones too, even when the sort leaves them out
  all.forEach((pickup) => {
    const group = groups.get(pickup.player.id);
    if (group && group.lead !== pickup) group.others.push(pickup);
  });
  groups.forEach((group) => group.others.sort((a, b) => a.time - b.time));
  return [...groups.values()];
}

export interface WaiverAward {
  emoji: string;
  title: string;
  // The big number on the card
  stat: string;
  headline: string;
  detail: string;
  teamID: string;
}

const pts = (value: number) => value.toFixed(2);
const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

// The highest scoring item; the first one wins a tie
function best<T>(items: T[], score: (item: T) => number): T | undefined {
  let top: T | undefined;
  let topScore = -Infinity;
  items.forEach((item) => {
    const value = score(item);
    if (value > topScore) {
      top = item;
      topScore = value;
    }
  });
  return top;
}

// The season's superlatives, best and worst. An award without a fitting
// pickup is left out.
export function getWaiverAwards(
  season: WaiverSeason,
  managers: Map<string, MatchupManager>,
): WaiverAward[] {
  const name = (id: string) => managers.get(id)?.name ?? id;
  const { pickups, lastWeek } = season;
  const awards: WaiverAward[] = [];

  // Each player wins once, even one several teams picked up, so the cards
  // don't repeat a name
  const used = new Set<string>();
  const award = (
    candidates: WaiverPickup[],
    score: (pickup: WaiverPickup) => number,
    card: (
      pickup: WaiverPickup,
    ) => Pick<WaiverAward, 'emoji' | 'title' | 'stat' | 'detail'>,
  ) => {
    const pickup = best(
      candidates.filter((p) => !used.has(p.player.id)),
      score,
    );
    if (!pickup) return;
    used.add(pickup.player.id);
    awards.push({
      ...card(pickup),
      headline: `${pickup.player.name} · ${name(pickup.franchiseID)}`,
      teamID: pickup.franchiseID,
    });
  };

  const scored = pickups.filter((p) => p.points > 0);
  const paid = pickups.filter((p) => p.cost > 0);

  award(
    scored,
    (p) => p.points,
    (p) => ({
      emoji: '🏆',
      title: 'Heist of the Year',
      stat: `${pts(p.points)} pts`,
      detail:
        p.cost === 0
          ? 'The best pickup of the season, and it was free.'
          : `The best pickup of the season, for $${p.cost}.`,
    }),
  );

  award(
    scored.filter((p) => p.cost === 0),
    (p) => p.points,
    (p) => ({
      emoji: '🆓',
      title: 'Free Real Estate',
      stat: `${pts(p.points)} pts`,
      detail: 'The best pickup that cost $0. Not a cent.',
    }),
  );

  award(
    scored.filter((p) => p.cost > 0),
    pointsPerDollar,
    (p) => ({
      emoji: '💸',
      title: 'Bang for the Buck',
      stat: `${pointsPerDollar(p).toFixed(1)} pts/$`,
      detail: `${pts(p.points)} pts for $${p.cost}.`,
    }),
  );

  award(
    scored.filter((p) => p.droppedBy),
    (p) => p.points,
    (p) => ({
      emoji: '🗑️',
      title: 'One Man’s Trash',
      stat: `${pts(p.points)} pts`,
      detail: `Cut by ${name(p.droppedBy!)} first. Oops.`,
    }),
  );

  // The biggest bid that has had time to pay off and didn't, the fewer
  // points first when two bids match
  award(
    paid.filter(
      (p) =>
        p.cost >= MONEY_PIT_MIN_COST &&
        pointsPerDollar(p) < MONEY_PIT_MAX_POINTS_PER_DOLLAR &&
        p.week !== null &&
        lastWeek - p.week + 1 >= MONEY_PIT_MIN_WEEKS,
    ),
    (p) => p.cost - pointsPerDollar(p) / MONEY_PIT_MAX_POINTS_PER_DOLLAR,
    (p) => ({
      emoji: '🕳️',
      title: 'Money Pit',
      stat: `$${p.cost}`,
      detail:
        p.points > 0
          ? `${pts(p.points)} pts. That’s $${(p.cost / p.points).toFixed(2)} a point.`
          : 'For zero points. Zero.',
    }),
  );

  // The biggest bid on a player who was on the roster but never started
  award(
    paid.filter((p) => p.games.length > 0 && p.games.every((g) => !g.starter)),
    (p) => p.cost + p.games.length / 100,
    (p) => ({
      emoji: '🪑',
      title: 'Paid to Sit',
      stat: `$${p.cost}`,
      detail: `${plural(p.games.length, 'week')} on the roster, never started.`,
    }),
  );

  // The player passed around the most, shown with whoever added him last
  const byPlayer = new Map<string, WaiverPickup[]>();
  pickups.forEach((p) =>
    byPlayer.set(p.player.id, [...(byPlayer.get(p.player.id) ?? []), p]),
  );
  const potato = best(
    [...byPlayer.entries()]
      .filter(
        ([id, list]) => !used.has(id) && list.length >= HOT_POTATO_MIN_PICKUPS,
      )
      .map(([, list]) => list),
    (list) => list.length,
  );
  if (potato) {
    // Each league's pickups are in time order, but not across leagues
    const latest = best(potato, (p) => p.time)!;
    const teams = new Set(potato.map((p) => p.franchiseID)).size;
    awards.push({
      emoji: '🥔',
      title: 'Hot Potato',
      stat: `${potato.length}×`,
      headline: `${latest.player.name} · now ${name(latest.franchiseID)}`,
      detail: `Picked up ${potato.length} times by ${plural(teams, 'team')}.`,
      teamID: latest.franchiseID,
    });
  }

  return awards;
}

export interface WaiverTeam {
  id: string;
  name: string;
  steak: boolean;
  moves: number;
  spent: number;
  budget: number | null;
  // Points pickups scored in the team's starting lineup
  started: number;
  best: WaiverPickup | null;
}

// Every team's waiver season, most points started from pickups first
export function getWaiverTeams(
  season: WaiverSeason,
  managers: Map<string, MatchupManager>,
): WaiverTeam[] {
  return [...managers.values()]
    .map((manager) => {
      const mine = season.pickups.filter((p) => p.franchiseID === manager.id);
      // Franchise IDs start with their league's name
      const league = Object.keys(season.budgets).find((name) =>
        manager.id.startsWith(name),
      );
      return {
        id: manager.id,
        name: manager.name,
        steak: manager.steak,
        moves: mine.length,
        spent: mine.reduce((sum, p) => sum + p.cost, 0),
        budget: league ? season.budgets[league] : null,
        started: mine.reduce((sum, p) => sum + p.started, 0),
        best: best(mine, (p) => p.points) ?? null,
      };
    })
    .sort((a, b) => b.started - a.started || a.name.localeCompare(b.name));
}
