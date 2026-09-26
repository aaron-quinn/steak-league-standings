import axios from 'axios';
import type { WaiverSeason, WeeklyScores, WeekPlayers } from '@/types/Fun';
import type { DraftResults } from '@/types/Draft';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-type': 'application/json',
  },
});

export async function getWeeklyScores(year: number): Promise<WeeklyScores[]> {
  const { data } = await api.get<WeeklyScores[]>(`/weekly-scores/${year}`);
  return data;
}

export async function getWeekPlayers(
  year: number,
  week: number,
): Promise<WeekPlayers> {
  const { data } = await api.get<WeekPlayers>(`/week-players/${year}/${week}`);
  return data;
}

export async function getDraft(year: number): Promise<DraftResults> {
  const { data } = await api.get<DraftResults>(`/draft/${year}`);
  return data;
}

export async function getWaivers(year: number): Promise<WaiverSeason> {
  const { data } = await api.get<WaiverSeason>(`/waivers/${year}`);
  return data;
}
