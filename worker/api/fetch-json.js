// Workers have no long-lived process to hold an in-memory cache, so responses
// are kept in Cloudflare's edge cache instead. That spares MFL (which rate
// limits) a request for every visitor. The edge cache is a no-op on workers.dev.
//
// A warm Worker instance also keeps the parsed result for the same length of
// time, since parsing MFL's larger exports is most of a request's CPU time.
// Callers share that object, so they must not modify it.
//
// Both copies are kept for a day past their lifetime. When MFL throttles us
// (429) or is down, callers get that last good copy rather than an error.
const STALE_SECONDS = 60 * 60 * 24;

// MFL asks clients that get a 429 to back off rather than retry. Its limits
// apply per server, so each host cools down separately.
const COOL_DOWN_MS = 60 * 1000;

const parsed = new Map();
const pending = new Map();
const coolingUntil = new Map();

export default async function fetchJSON(url, { cacheSeconds = 0 } = {}) {
  if (cacheSeconds <= 0) {
    return JSON.parse(await fetchFromOrigin(url));
  }

  const inMemory = parsed.get(url);
  if (inMemory && inMemory.expires > Date.now()) {
    return inMemory.data;
  }

  // Visitors arriving together all miss at once. Let them share one request
  // rather than each asking MFL.
  let request = pending.get(url);
  if (!request) {
    request = refresh(url, cacheSeconds).finally(() => pending.delete(url));
    pending.set(url, request);
  }
  return request;
}

async function refresh(url, cacheSeconds) {
  const cache = caches.default;
  const cached = await cache.match(url);

  // Keep the raw text so a miss is parsed once and stored as-is, rather than
  // parsed and then serialized again for the cache
  const cachedText = cached ? await cached.text() : null;
  const cachedExpires = Number(cached?.headers.get('X-Expires')) || 0;
  if (cachedText !== null && cachedExpires > Date.now()) {
    return remember(url, JSON.parse(cachedText), cachedExpires);
  }

  const host = new URL(url).host;
  const stale = () => {
    const inMemory = parsed.get(url);
    if (inMemory && inMemory.staleUntil > Date.now()) return inMemory.data;
    return cachedText !== null ? JSON.parse(cachedText) : undefined;
  };

  if ((coolingUntil.get(host) ?? 0) > Date.now()) {
    const data = stale();
    if (data !== undefined) return data;
  }

  let text;
  try {
    text = await fetchFromOrigin(url);
  } catch (error) {
    if (error.status === 429) {
      coolingUntil.set(host, Date.now() + COOL_DOWN_MS);
    }
    const data = stale();
    if (data === undefined) throw error;
    console.warn(`Serving a stale copy of ${url}: ${error.message}`);
    return data;
  }
  const data = JSON.parse(text);

  // MFL reports some failures as a 200 with an error body. Callers handle
  // those (live scoring in the offseason, for one), but a finished season's
  // data is kept for a month, so hold an error for a minute at most, and
  // never fall back to it later.
  const seconds = data?.error ? Math.min(cacheSeconds, 60) : cacheSeconds;
  const expires = Date.now() + seconds * 1000;
  const staleUntil = staleUntilFor(data, expires);

  await cache.put(
    url,
    new Response(text, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${Math.ceil((staleUntil - Date.now()) / 1000)}`,
        'X-Expires': String(expires),
      },
    }),
  );

  return remember(url, data, expires);
}

const staleUntilFor = (data, expires) =>
  data?.error ? expires : expires + STALE_SECONDS * 1000;

function remember(url, data, expires) {
  parsed.set(url, { data, expires, staleUntil: staleUntilFor(data, expires) });
  return data;
}

async function fetchFromOrigin(url) {
  const response = await fetch(url, {
    // Workers send no User-Agent, and ESPN answers 403 both to that and to
    // unrecognized ones. This is the header the Node API sent via axios.
    headers: { Accept: 'application/json', 'User-Agent': 'axios/1.7.9' },
  });
  if (!response.ok) {
    const error = new Error(
      `${response.status} ${response.statusText} from ${url}`,
    );
    error.status = response.status;
    throw error;
  }
  return response.text();
}
