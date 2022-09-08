import axios from 'axios';

const api = axios.create({
  baseURL: `/api`,
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
