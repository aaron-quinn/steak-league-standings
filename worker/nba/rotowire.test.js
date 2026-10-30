import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, readRotoWire, refreshRotoWire, ROTOWIRE_KEY, ROTOWIRE_STATUS_KEY, MAX_AGE } from './rotowire.js';
import { CURRENT_SEASON } from './config.js';

const now = Date.UTC(2026, 9, 30, 12);
const rows = Array.from({ length: 350 }, (_, i) => ({
  player: `Player Name${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + i % 26)}`, G: '40',
}));
const espn = { seasonId: CURRENT_SEASON, players: rows.map((r, id) => ({ player: {
  id, fullName: r.player, stats: [{ id: `00${CURRENT_SEASON}`, statSourceId: 0, stats: { 42: 5 } }],
} })) };
const kv = () => {
  const data = new Map();
  return { data, async get(key) { return JSON.parse(data.get(key) ?? 'null'); }, async put(key, value) { data.set(key, value); } };
};

test('normalizes names, preserves zero, and converts remaining games using current season games', () => {
  const input = structuredClone(rows);
  input[0] = { player: `${rows[0].player} Jr.`, G: '0' };
  const snapshot = buildSnapshot(input, espn, now);
  assert.equal(snapshot.seasonGames[0], 5);
  assert.equal(snapshot.seasonGames[1], 45);
  assert.equal(snapshot.players, 350);
  // ESPN's live player-only response has no top-level seasonId.
  assert.equal(buildSnapshot(rows, { players: espn.players }, now).players, 350);
});

test('rejects paywall previews, wrong seasons, invalid games and ambiguous names', () => {
  assert.throws(() => buildSnapshot(rows.slice(0, 7), espn), /coverage/);
  assert.throws(() => buildSnapshot(rows, { ...espn, seasonId: 2026 }), /season/);
  for (const G of ['', null, 'NaN', '-1', '83']) {
    assert.throws(() => buildSnapshot([{ ...rows[0], G }, ...rows.slice(1)], espn), /invalid/);
  }
  assert.throws(() => buildSnapshot([...rows, rows[0]], espn), /ambiguous/);
  assert.throws(() => buildSnapshot(rows, { ...espn, players: espn.players.map(e => ({ player: { ...e.player, fullName: 'Unknown' } })) }), /matched/);
});

test('failed refresh preserves last successful download and exposes failure without credentials', async () => {
  const NBA = kv();
  const previous = buildSnapshot(rows, espn, now);
  await NBA.put(ROTOWIRE_KEY, JSON.stringify(previous));
  await assert.rejects(refreshRotoWire({ NBA }, undefined, now + 1000), /refresh failed/);
  assert.deepEqual(await NBA.get(ROTOWIRE_KEY), previous);
  const result = await readRotoWire({ NBA }, now + 1000);
  assert.equal(result.fresh, true);
  assert.equal(result.refreshFailed, true);
  assert.equal(result.seasonGames[0], 45);
});

test('expired, future, wrong-season and missing snapshots fall back without returning games', async () => {
  const NBA = kv();
  assert.equal((await readRotoWire({ NBA }, now)).fresh, false);
  const snapshot = buildSnapshot(rows, espn, now);
  await NBA.put(ROTOWIRE_KEY, JSON.stringify(snapshot));
  assert.equal((await readRotoWire({ NBA }, now + MAX_AGE - 1)).fresh, true);
  for (const at of [now - 1, now + MAX_AGE]) {
    const result = await readRotoWire({ NBA }, at);
    assert.equal(result.fresh, false);
    assert.deepEqual(result.seasonGames, {});
  }
  await NBA.put(ROTOWIRE_KEY, JSON.stringify({ ...snapshot, season: 2026 }));
  assert.equal((await readRotoWire({ NBA }, now)).fresh, false);
});

test('authenticated refresh passes session cookies and stores only validated data', async () => {
  const NBA = kv();
  const paths = [];
  const fetcher = async (url, init) => {
    const path = new URL(url).pathname;
    paths.push(path);
    if (path.endsWith('/login/')) return new Response('login', { headers: { 'Set-Cookie': 'session=example; Path=/; Secure' } });
    if (path.endsWith('csrf-token.php')) {
      assert.equal(init.headers.Cookie, 'session=example');
      return Response.json({ csrf_token: 'csrf' });
    }
    if (path.endsWith('api/login.php')) {
      assert.equal(init.headers['X-CSRF-TOKEN'], 'csrf');
      assert.deepEqual(JSON.parse(init.body), { username: 'test', password: 'test' });
      return Response.json({ success: true });
    }
    if (path === '/basketball/projections.php') return new Response('2026-27 NBA projected stats for the remainder of the season');
    if (path.includes('/tables/')) return Response.json(rows);
    return Response.json(espn);
  };
  await refreshRotoWire({ NBA, ROTOWIRE_USERNAME: 'test', ROTOWIRE_PASSWORD: 'test' }, fetcher, now);
  assert.equal(paths.length, 6);
  assert.equal((await NBA.get(ROTOWIRE_KEY)).players, 350);
  assert.equal((await NBA.get(ROTOWIRE_STATUS_KEY)).ok, true);
});
