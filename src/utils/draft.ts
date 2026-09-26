import type { DraftLeague, DraftPick } from '@/types/Draft';

export const LEAGUE_NAMES: Record<string, string> = {
  madison: 'Madison',
  la: 'LA',
};

export interface LeaguePick extends DraftPick {
  league: string;
  // Worth less price; null until anyone has scored
  value: number | null;
}

// Every pick in the given leagues
export function listPicks(leagues: DraftLeague[]): LeaguePick[] {
  return leagues.flatMap(({ league, picks }) =>
    picks.map((pick) => ({
      ...pick,
      league,
      value: pick.worth === null ? null : pick.worth - pick.price,
    })),
  );
}

export interface TeamDraft {
  franchiseID: string;
  league: string;
  spent: number;
  worth: number;
  value: number;
}

// Each team's picks added up, best draft first
export function teamDrafts(picks: LeaguePick[]): TeamDraft[] {
  const teams = new Map<string, TeamDraft>();
  picks.forEach((pick) => {
    const team = teams.get(pick.franchiseID) ?? {
      franchiseID: pick.franchiseID,
      league: pick.league,
      spent: 0,
      worth: 0,
      value: 0,
    };
    team.spent += pick.price;
    team.worth += pick.worth ?? 0;
    team.value = team.worth - team.spent;
    teams.set(pick.franchiseID, team);
  });
  return [...teams.values()].sort((a, b) => b.value - a.value);
}

export interface PriceGap {
  id: string;
  name: string;
  position: string;
  // Dearest first
  picks: LeaguePick[];
  gap: number;
}

// Players both leagues bought, the most differently priced first
export function priceGaps(picks: LeaguePick[]): PriceGap[] {
  const byPlayer = new Map<string, LeaguePick[]>();
  picks.forEach((pick) =>
    byPlayer.set(pick.id, [...(byPlayer.get(pick.id) ?? []), pick]),
  );
  return [...byPlayer.values()]
    .filter((bought) => bought.length > 1)
    .map((bought) => {
      const sorted = [...bought].sort((a, b) => b.price - a.price);
      return {
        id: sorted[0].id,
        name: sorted[0].name,
        position: sorted[0].position,
        picks: sorted,
        gap: sorted[0].price - sorted[sorted.length - 1].price,
      };
    })
    .sort((a, b) => b.gap - a.gap || b.picks[0].price - a.picks[0].price);
}

export const formatDollars = (amount: number) =>
  `$${Math.round(amount).toLocaleString()}`;

// "+$38", "−$48" or "$0", in whole dollars
export function formatValue(value: number) {
  const dollars = Math.round(value);
  if (dollars === 0) return '$0';
  return `${dollars > 0 ? '+' : '−'}$${Math.abs(dollars)}`;
}

export const valueColor = (value: number) =>
  Math.round(value) > 0
    ? 'text-emerald-400/80'
    : Math.round(value) < 0
      ? 'text-red-400/75'
      : 'text-gray-500';
