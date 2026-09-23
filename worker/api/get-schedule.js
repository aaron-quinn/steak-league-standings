import axios from 'axios';

const api = axios.create({
  baseURL: 'https://site.api.espn.com',
  headers: {
    'Content-type': 'application/json',
  },
});

export default async function getSchedule(url) {
  const { data } = await api.get(url);
  return data;
}
