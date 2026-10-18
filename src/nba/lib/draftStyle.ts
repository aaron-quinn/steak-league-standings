import type { DraftPick, NbaLeague } from './data';
// Explicit extension so Node scripts can load this too
import { personName } from './standings.ts';

// Auction habits across seasons. A study of the 2019–2026 auctions (steak-nba
// repo, research/manager_tendencies.py) found three habits that hold from one
// season to the next: how many $1–2 players a manager buys, how much of the
// budget goes in the first third of the auction, and how pricey the players
// they nominate are. Star spending, position mix and category taste didn't
// hold, so they aren't shown. Same thresholds as the study.

export type HabitKey = 'cheap' | 'early' | 'nominated';

export const HABITS: { key: HabitKey; label: string }[] = [
  { key: 'cheap', label: '$1–2 players' },
  { key: 'early', label: 'Budget spent in the first third' },
  { key: 'nominated', label: 'Average price of players nominated' },
];

// A habit needs this many auctions, this far from the league (in standard
// deviations), on the same side in this share of seasons
const MIN_SEASONS = 3;
const MIN_STRENGTH = 0.75;
const MIN_SAME_SIDE = 0.75;

interface StyleSeason {
  season: number;
  owner: string;
  values: Partial<Record<HabitKey, number>>;
}

export interface Habit {
  key: HabitKey;
  direction: 'high' | 'low';
  // Their average and the league's, in the habit's own units
  mine: number;
  league: number;
  sameSide: number;
  seasons: number;
  strength: number;
}

export interface Rebuy {
  playerID: number;
  player: string;
  buys: { season: number; price: number }[];
}

export interface DraftStyle {
  owner: string;
  auctions: number;
  habits: Habit[];
  rebuys: Rebuy[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

function seasonRows(league: NbaLeague): StyleSeason[] {
  const picks = [...league.draft].filter((p) => p.playerID > 0).sort((a, b) => a.pick - b.pick);
  if (!picks.length) return [];
  const third = picks.length / 3;
  return league.teams.flatMap((team) => {
    if (!team.owner) return [];
    const mine = picks.filter((p) => p.team === team.id);
    if (!mine.length) return [];
    const spent = mine.reduce((n, p) => n + p.price, 0);
    // Seasons saved before nominators were recorded have none
    const nominated = picks.filter((p) => p.nominator === team.id);
    return [
      {
        season: league.season,
        owner: personName(team),
        values: {
          cheap: mine.filter((p) => p.price <= 2).length,
          early: spent ? mine.filter((p) => p.pick <= third).reduce((n, p) => n + p.price, 0) / spent : 0,
          ...(nominated.length ? { nominated: mean(nominated.map((p) => p.price)) } : {}),
        },
      },
    ];
  });
}

// Every manager's habits and repeat buys, from every season with an auction
export function draftStyles(leagues: NbaLeague[]): Map<string, DraftStyle> {
  const rows = leagues.flatMap(seasonRows);
  const styles = new Map<string, DraftStyle>();
  for (const r of rows) {
    if (!styles.has(r.owner)) styles.set(r.owner, { owner: r.owner, auctions: 0, habits: [], rebuys: [] });
    styles.get(r.owner)!.auctions++;
  }

  for (const { key } of HABITS) {
    const have = rows.filter((r) => r.values[key] !== undefined);
    // Relative to each season's league, so league-wide drift isn't a habit
    const seasonMean = new Map<number, number>();
    for (const s of new Set(have.map((r) => r.season))) {
      seasonMean.set(s, mean(have.filter((r) => r.season === s).map((r) => r.values[key]!)));
    }
    const adj = have.map((r) => ({ r, d: r.values[key]! - seasonMean.get(r.season)! }));
    const sd = Math.sqrt(mean(adj.map((a) => a.d ** 2))) || 1;
    const league = mean(have.map((r) => r.values[key]!));
    for (const style of styles.values()) {
      const mine = adj.filter((a) => a.r.owner === style.owner);
      if (mine.length < MIN_SEASONS) continue;
      const m = mean(mine.map((a) => a.d));
      const sameSide = mine.filter((a) => Math.sign(a.d) === Math.sign(m)).length;
      if (Math.abs(m) / sd < MIN_STRENGTH || sameSide / mine.length < MIN_SAME_SIDE) continue;
      style.habits.push({
        key,
        direction: m > 0 ? 'high' : 'low',
        mine: mean(mine.map((a) => a.r.values[key]!)),
        league,
        sameSide,
        seasons: mine.length,
        strength: Math.abs(m) / sd,
      });
    }
  }

  // Players bought by the same manager in more than one auction
  const buys = new Map<string, Rebuy>();
  for (const league of leagues) {
    for (const p of league.draft) {
      const team = league.teams.find((t) => t.id === p.team);
      if (!team?.owner || p.playerID <= 0) continue;
      const key = `${personName(team)}|${p.playerID}`;
      if (!buys.has(key)) {
        buys.set(key, { playerID: p.playerID, player: league.names?.[p.playerID] ?? `Player ${p.playerID}`, buys: [] });
      }
      buys.get(key)!.buys.push({ season: league.season, price: p.price });
    }
  }
  for (const [key, rebuy] of buys) {
    if (rebuy.buys.length < 2) continue;
    rebuy.buys.sort((a, b) => b.season - a.season);
    styles.get(key.split('|')[0])?.rebuys.push(rebuy);
  }
  for (const style of styles.values()) {
    style.habits.sort((a, b) => b.strength - a.strength);
    style.rebuys.sort((a, b) => b.buys.length - a.buys.length || b.buys[0].season - a.buys[0].season);
  }
  return styles;
}

// The habit in a sentence, and what it means on draft night
export function describeHabit(h: Habit): { text: string; hint: string } {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const tail = `league ${h.key === 'early' ? pct(h.league) : h.key === 'cheap' ? h.league.toFixed(1) : `$${h.league.toFixed(1)}`}; ${h.sameSide} of ${h.seasons} seasons`;
  const high = h.direction === 'high';
  switch (h.key) {
    case 'cheap':
      return high
        ? { text: `Fills out with $1–2 players: ${h.mine.toFixed(1)} a year (${tail})`, hint: 'Spends big at the top.' }
        : { text: `Rarely buys $1–2 players: ${h.mine.toFixed(1)} a year (${tail})`, hint: 'Still bidding late.' };
    case 'early':
      return high
        ? { text: `Spends early: ${pct(h.mine)} of the budget in the first third (${tail})`, hint: 'Usually short of money late.' }
        : { text: `Saves money: ${pct(h.mine)} of the budget in the first third (${tail})`, hint: 'Has money for late bargains.' };
    case 'nominated':
      return high
        ? { text: `Nominates expensive players: $${h.mine.toFixed(1)} on average (${tail})`, hint: 'Puts stars up early.' }
        : { text: `Nominates cheap players: $${h.mine.toFixed(1)} on average (${tail})`, hint: 'Holds stars back.' };
  }
}

// Price tiers, the same bands as the steak-nba research
export const PRICE_BANDS = [
  { min: 45, label: '$45+' },
  { min: 30, label: '$30–44' },
  { min: 18, label: '$18–29' },
  { min: 8, label: '$8–17' },
  { min: 3, label: '$3–7' },
  { min: 0, label: '$1–2' },
] as const;

export interface BandRow {
  label: string;
  picks: number;
  price: number;
  points: number;
  // Average roto points beyond what the price promised (see buildDraft)
  surplus: number;
  // Share of picks that fell short of their price by 5+ roto points
  busts: number;
}

type Scored = Pick<DraftPick, 'price'> & { points: number; surplus: number };

// What each price tier produced, from picks with results
export function priceBands(picks: Scored[]): BandRow[] {
  return PRICE_BANDS.map((band, i) => {
    const hi = i === 0 ? Infinity : PRICE_BANDS[i - 1].min;
    const inBand = picks.filter((p) => p.price >= band.min && p.price < hi);
    return {
      label: band.label,
      picks: inBand.length,
      price: mean(inBand.map((p) => p.price)),
      points: mean(inBand.map((p) => p.points)),
      surplus: mean(inBand.map((p) => p.surplus)),
      busts: inBand.length ? inBand.filter((p) => p.surplus <= -5).length / inBand.length : 0,
    };
  }).filter((b) => b.picks > 0);
}
