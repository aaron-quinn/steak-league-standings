import type { WaiverPlayer } from './Fun';

export type TradeMetric = 'lift' | 'started' | 'points';
export interface TradePlayer extends WaiverPlayer {
  supported: boolean;
  points: number;
  started: number;
  games: { week: number; score: number; starter: boolean }[];
}
export interface TradeSide {
  franchiseID: string;
  received: TradePlayer[];
  points: number;
  started: number;
  lift: number | null;
  impact: {
    week: number;
    withTrade: number | null;
    withoutTrade: number | null;
    lift: number | null;
  }[];
}
export interface Trade {
  season: number;
  id: string;
  league: string;
  time: number;
  week: number | null;
  unsupported: boolean;
  evaluated: boolean;
  sides: TradeSide[];
}
export interface TradeSeason {
  lastWeek: number;
  trades: Trade[];
}
