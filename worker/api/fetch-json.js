// Workers have no long-lived process to hold an in-memory cache, so responses
// are kept in Cloudflare's edge cache instead. That spares MFL (which rate
// limits) a request for every visitor. The edge cache is a no-op on workers.dev.
//
// A warm Worker instance also keeps the parsed result for the same length of
// time, since parsing MFL's larger exports is most of a request's CPU time.
// Callers share that object, so they must not modify it.
const parsed = new Map();

export default async function fetchJSON(url, { cacheSeconds = 0 } = {}) {
  const cache = cacheSeconds > 0 ? caches.default : null;

  const inMemory = parsed.get(url);
  if (inMemory && inMemory.expires > Date.now()) {
    return inMemory.data;
  }

  const cached = await cache?.match(url);
  const data = cached ? await cached.json() : await fetchFromOrigin(url);

  if (cache && !cached) {
    await cache.put(
      url,
      new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${cacheSeconds}`,
        },
      }),
    );
  }

  if (cacheSeconds > 0) {
    parsed.set(url, { data, expires: Date.now() + cacheSeconds * 1000 });
  }

  return data;
}

async function fetchFromOrigin(url) {
  const response = await fetch(url, {
    // Workers send no User-Agent, and ESPN answers 403 both to that and to
    // unrecognized ones. This is the header the Node API sent via axios.
    headers: { Accept: 'application/json', 'User-Agent': 'axios/1.7.9' },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }
  return response.json();
}
