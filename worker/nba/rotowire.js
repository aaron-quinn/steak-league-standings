import { CURRENT_SEASON, ESPN_LEAGUE, GP } from './config.js';
import { PLAYERS_FILTER, PLAYERS_VIEWS } from './espn.js';

export const ROTOWIRE_KEY = `rotowire:${CURRENT_SEASON}`;
export const ROTOWIRE_STATUS_KEY = `${ROTOWIRE_KEY}:status`;
export const MAX_AGE = 48 * 60 * 60 * 1000;
class RefreshError extends Error {}
const BASE = 'https://www.rotowire.com';
const normalize = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z]/g, '');

// Only this function holds credentials and session cookies. Nothing private
// is persisted in KV, returned to a visitor, or included in error messages.
export async function downloadProjections(env, fetcher = fetch) {
  if (!env.ROTOWIRE_USERNAME || !env.ROTOWIRE_PASSWORD) throw new RefreshError('RotoWire credentials missing');
  const cookies = new Map();
  async function request(path, init = {}) {
    const response = await fetcher(BASE + path, {
      ...init, redirect: 'manual', signal: AbortSignal.timeout(20000),
      headers: {
        'User-Agent': 'Mozilla/5.0', Referer: `${BASE}/subscribe/login/`,
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...init.headers,
      },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const i = pair.indexOf('=');
      if (i > 0) cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    if (!response.ok) throw new RefreshError(`RotoWire request failed (${response.status})`);
    return response;
  }
  await (await request('/subscribe/login/')).text();
  const csrf = await (await request('/subscribe/ajax/csrf-token.php')).json();
  if (!csrf.csrf_token) throw new RefreshError('RotoWire login token missing');
  const login = await (await request('/subscribe/buy-flow/api/login.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf.csrf_token },
    body: JSON.stringify({ username: env.ROTOWIRE_USERNAME, password: env.ROTOWIRE_PASSWORD }),
  })).json();
  if (!login.success) throw new RefreshError('RotoWire login rejected');
  const page = await (await request('/basketball/projections.php?type=ros')).text();
  const label = `${CURRENT_SEASON - 1}-${String(CURRENT_SEASON).slice(2)}`;
  if (!page.includes(`${label} NBA projected stats for the remainder of the season`)) {
    throw new RefreshError('RotoWire season or projection type mismatch');
  }
  return (await request('/basketball/tables/projections.php?type=ros&pos=ALL')).json();
}

export function buildSnapshot(rows, espn, now = Date.now()) {
  if (!Array.isArray(rows) || rows.length < 300) throw new RefreshError('RotoWire player coverage too small');
  if ((espn.seasonId != null && espn.seasonId !== CURRENT_SEASON) ||
      !Array.isArray(espn.players) || espn.players.length < 300 ||
      !espn.players.some(e => e.player?.stats?.some(s => s.id === `00${CURRENT_SEASON}` && s.statSourceId === 0))) {
    throw new RefreshError('ESPN season or player coverage mismatch');
  }
  const byName = new Map();
  for (const row of rows) {
    const g = row.G;
    if (typeof row.player !== 'string' || !row.player.trim() || g === '' || g == null ||
        !Number.isFinite(Number(g)) || Number(g) < 0 || Number(g) > 82) {
      throw new RefreshError('RotoWire invalid games or player name');
    }
    const name = normalize(row.player);
    if (byName.has(name)) throw new RefreshError('RotoWire ambiguous player name');
    byName.set(name, Number(g));
  }
  const seasonGames = {};
  for (const { player } of espn.players) {
    if (!player?.fullName || !Number.isInteger(player.id)) continue;
    const remaining = byName.get(normalize(player.fullName));
    if (remaining === undefined) continue;
    const played = player.stats?.find(s => s.id === `00${CURRENT_SEASON}` && s.statSourceId === 0)?.stats?.[GP] ?? 0;
    if (!Number.isFinite(played) || played < 0 || played > 82) throw new RefreshError('ESPN invalid games played');
    seasonGames[player.id] = Math.min(82, remaining + played);
  }
  if (Object.keys(seasonGames).length < 300) throw new RefreshError('RotoWire matched player coverage too small');
  return { season: CURRENT_SEASON, fetchedAt: new Date(now).toISOString(), seasonGames, players: Object.keys(seasonGames).length };
}

export async function refreshRotoWire(env, fetcher = fetch, now = Date.now()) {
  try {
    const rows = await downloadProjections(env, fetcher);
    const response = await fetcher(`${ESPN_LEAGUE(CURRENT_SEASON)}?${PLAYERS_VIEWS}`, {
      headers: { 'User-Agent': 'axios/1.7.9', 'X-Fantasy-Filter': PLAYERS_FILTER(CURRENT_SEASON) },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new RefreshError('ESPN player request failed');
    const snapshot = buildSnapshot(rows, await response.json(), now);
    // Do not expire the last successful snapshot: freshness is assessed when
    // serving it, and a failed refresh must never erase usable data.
    await env.NBA.put(ROTOWIRE_KEY, JSON.stringify(snapshot));
    await env.NBA.put(ROTOWIRE_STATUS_KEY, JSON.stringify({ attemptedAt: new Date(now).toISOString(), ok: true }));
    console.log(`RotoWire refresh succeeded: ${snapshot.players} matched players`);
    return snapshot;
  } catch (error) {
    await env.NBA.put(ROTOWIRE_STATUS_KEY, JSON.stringify({ attemptedAt: new Date(now).toISOString(), ok: false }));
    // Avoid logging third-party responses, cookies or account details.
    console.error('RotoWire refresh failed; retaining last successful snapshot', error instanceof RefreshError ? error.message : 'Network or response format error');
    throw new RefreshError('RotoWire refresh failed');
  }
}

export async function readRotoWire(env, now = Date.now()) {
  const [snapshot, status] = await Promise.all([
    env.NBA.get(ROTOWIRE_KEY, 'json'), env.NBA.get(ROTOWIRE_STATUS_KEY, 'json'),
  ]);
  const age = now - Date.parse(snapshot?.fetchedAt);
  const fresh = snapshot?.season === CURRENT_SEASON && age >= 0 && age < MAX_AGE;
  return {
    season: CURRENT_SEASON, fetchedAt: snapshot?.fetchedAt ?? null,
    expiresAt: snapshot?.fetchedAt ? new Date(Date.parse(snapshot.fetchedAt) + MAX_AGE).toISOString() : null,
    lastAttemptAt: status?.attemptedAt ?? null, refreshFailed: status?.ok === false,
    fresh, seasonGames: fresh ? snapshot.seasonGames : {},
  };
}
