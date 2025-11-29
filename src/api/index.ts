import axios from 'axios';
import type { StandingsData } from '../types/StandingsData';

const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_URL,
  headers: {
    'Content-type': 'application/json',
  },
});

export async function getStandings(url: string): Promise<StandingsData> {
  const { data } = await api.get<StandingsData>(url);
  return data;
}

export default {
  getData: getStandings,
};
