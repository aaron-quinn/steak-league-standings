import fetchJSON from './fetch-json.js';

const baseURL = 'https://api.myfantasyleague.com';

export default async function getData(url, options) {
  return fetchJSON(`${baseURL}${url}`, options);
}
