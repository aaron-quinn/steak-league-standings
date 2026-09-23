import axios from 'axios';
import { MatchupsData } from '@/types/MatchupsData';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-type': 'application/json',
  },
});

export async function getMatchups(url: string): Promise<MatchupsData> {
  const { data } = await api.get<MatchupsData>(url);
  return data;
}

export default {
  getData: getMatchups,
};
