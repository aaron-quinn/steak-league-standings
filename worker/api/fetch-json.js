// Workers have no long-lived process to hold an in-memory cache, so responses
// are kept in Cloudflare's edge cache instead. That spares MFL (which rate
// limits) a request for every visitor. The cache is a no-op on workers.dev.
export default async function fetchJSON(url, { cacheSeconds = 0 } = {}) {
  const cache = cacheSeconds > 0 ? caches.default : null;

  const cached = await cache?.match(url);
  if (cached) {
    return cached.json();
  }

  const response = await fetch(url, {
    // Workers send no User-Agent, and ESPN answers 403 both to that and to
    // unrecognized ones. This is the header the Node API sent via axios.
    headers: { Accept: 'application/json', 'User-Agent': 'axios/1.7.9' },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }

  const data = await response.json();

  if (cache) {
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

  return data;
}
