import axios from 'axios';
import type { WeeklyScores, WeekPlayers } from '@/types/Fun';

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
