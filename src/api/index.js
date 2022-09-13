import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_URL,
  headers: {
    'Content-type': 'application/json',
  },
});

export default {
  async getData(url) {
    const { data } = await api.get(url);
    return data;
  },
};
