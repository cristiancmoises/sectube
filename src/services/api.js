import axios from 'axios';

// Same-origin /api. nginx injects the RapidAPI key server-side; the browser
// never sees it. See docker/nginx/nginx.conf.template.
const API_BASE = '/api';

const http = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
});

// --- In-memory cache (URL -> { data, expiresAt }) ----------------------------
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes is fine — quota matters
const cache = new Map();

function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return e.data;
}

function cacheSet(key, data) {
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export class ApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.cause = cause;
  }
}

/**
 * Fetch from the proxied YouTube metadata API.
 * Components expect YouTube-Data-v3-shaped JSON; RapidAPI returns it
 * natively, so no translation layer needed.
 *
 * @param {string} path  e.g. "search?part=snippet&q=New"
 * @param {{ signal?: AbortSignal, noCache?: boolean }} [opts]
 */
export async function fetchApi(path, opts = {}) {
  if (!opts.noCache) {
    const hit = cacheGet(path);
    if (hit) return hit;
  }
  try {
    const res = await http.get(path, { signal: opts.signal });
    cacheSet(path, res.data);
    return res.data;
  } catch (err) {
    if (axios.isCancel(err) || err.name === 'CanceledError') throw err;
    const status = err?.response?.status;
    const msg =
      status === 429 ? 'Rate limit reached. Try again in a moment.'
        : status === 401 || status === 403
          ? 'API access denied. The server admin needs to set RAPIDAPI_KEY.'
          : status === 404 ? 'Not found.'
            : status >= 500 ? 'The upstream service is unavailable right now.'
              : 'Failed to load. Check your connection.';
    throw new ApiError(msg, { status, cause: err });
  }
}

// Back-compat shim for any older callsites.
export const ApiService = { fetching: (url) => fetchApi(url) };
