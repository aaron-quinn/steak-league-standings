import type { Trade, TradeMetric } from '@/types/Trades';

export const FIRST_TRADE_SEASON = 2016;
type TradeManagers = Map<string, { name: string }>;

function managerOf(trade: Trade, id: string, managers: TradeManagers) {
  return managers.get(`${trade.season}:${id}`) ?? managers.get(id);
}

export function tradeTeamName(
  trade: Trade,
  id: string,
  managers: TradeManagers,
) {
  return (
    managerOf(trade, id, managers)?.name ??
    `${trade.league === 'la' ? 'LA' : 'Madison'} ${id.replace(/^(la|madison)/, '')}`
  );
}

export function tradeTeamKey(
  trade: Trade,
  id: string,
  managers: TradeManagers,
  allTime = false,
) {
  if (!allTime) return id;
  const manager = managerOf(trade, id, managers);
  return manager ? `manager:${manager.name}` : `${trade.season}:${id}`;
}

export const TRADE_METRICS: {
  value: TradeMetric;
  label: string;
  description: string;
}[] = [
  {
    value: 'lift',
    label: 'Lineup lift',
    description:
      'How much better could each team’s lineup be with the trade than without it? Both sides can gain.',
  },
  {
    value: 'started',
    label: 'Started points',
    description:
      'Points the received players actually scored in their new team’s starting lineup. Rewards production that counted.',
  },
  {
    value: 'points',
    label: 'Roster points',
    description:
      'All points the received players scored while held by their new team, including the bench. Rewards talent acquired.',
  },
];

export function tradeVerdict(trade: Trade, metric: TradeMetric) {
  if (trade.unsupported)
    return { kind: 'unrated', winner: null, label: 'Unrated assets' };
  if (!trade.evaluated) {
    return { kind: 'pending', winner: null, label: 'No scored weeks yet' };
  }
  const [a, b] = trade.sides.map((s) => s[metric]);
  if (a === null || b === null)
    return {
      kind: 'unrated',
      winner: null,
      label: 'Incomplete lineup data',
    };
  const winner =
    Math.round(a * 100) === Math.round(b * 100)
      ? null
      : a > b
        ? trade.sides[0].franchiseID
        : trade.sides[1].franchiseID;
  const kind =
    metric === 'lift' && a > 0 && b > 0
      ? 'both-gained'
      : metric === 'lift' && a < 0 && b < 0
        ? 'both-lost'
        : winner === null
          ? 'tie'
          : 'edge';
  return {
    kind,
    winner,
    label:
      kind === 'both-gained'
        ? 'Both gained'
        : kind === 'both-lost'
          ? 'Both lost value'
          : winner === null
            ? 'Even trade'
            : 'Trade winner',
  };
}

// A one-word read on a deal for the top of its card, sized by the margin
export function tradeKicker(trade: Trade, metric: TradeMetric) {
  const verdict = tradeVerdict(trade, metric);
  if (verdict.kind === 'pending') return 'Too early to call';
  if (verdict.kind === 'unrated') return 'Unrated';
  if (verdict.kind === 'both-gained') return 'Win-win';
  if (verdict.kind === 'both-lost') return 'Lose-lose';
  if (!verdict.winner) return 'Dead even';
  const [a, b] = trade.sides.map((s) => s[metric] ?? 0);
  const gap = Math.abs(a - b);
  return gap >= 100
    ? 'Fleeced'
    : gap >= 30
      ? 'Clear win'
      : gap < 10
        ? 'Coin flip'
        : 'Edge';
}

export function rankTradeTeams(
  trades: Trade[],
  metric: TradeMetric,
  managers: TradeManagers,
  allTime = false,
) {
  const teams = new Map<
    string,
    {
      id: string;
      name: string;
      value: number;
      trades: number;
      rated: number;
      wins: number;
      losses: number;
      gains: number;
      leagues: Set<string>;
      seasons: Set<number>;
    }
  >();
  trades.forEach((trade) => {
    const verdict = tradeVerdict(trade, metric);
    trade.sides.forEach((side) => {
      const id = tradeTeamKey(trade, side.franchiseID, managers, allTime);
      const team = teams.get(id) ?? {
        id,
        name:
          managerOf(trade, side.franchiseID, managers)?.name ??
          (allTime
            ? `${tradeTeamName(trade, side.franchiseID, managers)} (${trade.season})`
            : side.franchiseID),
        value: 0,
        trades: 0,
        rated: 0,
        wins: 0,
        losses: 0,
        gains: 0,
        leagues: new Set<string>(),
        seasons: new Set<number>(),
      };
      team.trades++;
      team.leagues.add(trade.league);
      team.seasons.add(trade.season);
      const value = side[metric];
      if (
        value !== null &&
        verdict.kind !== 'pending' &&
        verdict.kind !== 'unrated'
      ) {
        team.value = Math.round((team.value + value) * 100) / 100;
        team.rated++;
        if (verdict.winner === side.franchiseID) team.wins++;
        else if (verdict.winner) team.losses++;
        if (value > 0) team.gains++;
      }
      teams.set(id, team);
    });
  });
  return [...teams.values()]
    .map((team) => ({
      ...team,
      leagues: [...team.leagues].sort(),
      seasons: [...team.seasons].sort((a, b) => a - b),
    }))
    .sort(
      (a, b) =>
        Number(b.rated > 0) - Number(a.rated > 0) ||
        b.value - a.value ||
        b.wins - a.wins ||
        a.name.localeCompare(b.name),
    );
}

export type TradeTeam = ReturnType<typeof rankTradeTeams>[number];
export type TradeTeamSort = 'total' | 'average' | 'winRate';

// Rates swing wildly on a deal or two, so they only rank teams with this many
// rated deals
export const MIN_RATE_DEALS = 3;

export function tradeWinRate(team: TradeTeam) {
  return team.rated ? team.wins / team.rated : null;
}

// Whether a team gets a rank under the given sort
export function tradeTeamRanked(team: TradeTeam, by: TradeTeamSort) {
  return team.rated >= (by === 'total' ? 1 : MIN_RATE_DEALS);
}

// Re-rank teams already ordered by rankTradeTeams. Teams without enough
// rated deals keep their total order below everyone ranked.
export function sortTradeTeams(teams: TradeTeam[], by: TradeTeamSort) {
  if (by === 'total') return teams;
  const score = (t: TradeTeam) =>
    by === 'winRate' ? tradeWinRate(t)! : t.value / t.rated;
  const ranked = teams.filter((t) => tradeTeamRanked(t, by));
  const rest = teams.filter((t) => !tradeTeamRanked(t, by));
  return [
    ...ranked.sort((a, b) => score(b) - score(a) || b.value - a.value),
    ...rest,
  ];
}

export function tradeNumber(value: number | null, signed = false) {
  if (value === null) return '—';
  return `${signed && value > 0 ? '+' : ''}${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
}
