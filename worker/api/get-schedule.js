import fetchJSON from './fetch-json.js';

const baseURL = 'https://site.api.espn.com';

export default async function getSchedule(url, options) {
  return fetchJSON(`${baseURL}${url}`, options);
}
