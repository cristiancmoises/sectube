import axios from 'axios';

// Same-origin /api. nginx injects ?key=… server-side; the browser never sees
// the API key. See docker/nginx/nginx.conf.template.
const API_BASE = '/api';

const http = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
});

// --- In-memory cache (URL -> { data, expiresAt }) ----------------------------
// Caching matters more with Google's quota: search costs 100 units, so a
// repeated search (back navigation, etc.) without cache wastes a lot of quota.
const CACHE_TTL_MS = 5 * 60 * 1000;
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
  constructor(message, { status, cause, googleReason } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.cause = cause;
    this.googleReason = googleReason;
  }
}

/**
 * Extract Google's structured error reason from a 4xx response.
 * Format: { error: { code, message, errors: [{ reason, ... }] } }
 */
function googleReasonOf(err) {
  try {
    const errs = err?.response?.data?.error?.errors;
    if (Array.isArray(errs) && errs[0]?.reason) return errs[0].reason;
  } catch { /* ignore */ }
  return null;
}

/**
 * Map Google API error codes to user-friendly messages.
 * 403 quotaExceeded   → daily quota gone, resets midnight Pacific
 * 403 keyInvalid      → key missing or wrong
 * 403 keyExpired      → key disabled
 * 403 ipRefererBlocked→ API key has a restriction that blocks this origin
 * 400 badRequest      → malformed query
 * 404                 → not found
 * 5xx                 → Google's problem
 */
function friendlyMessageFor(status, reason) {
  if (status === 403) {
    if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded')
      return 'Daily API quota reached. Resets at midnight Pacific time.';
    if (reason === 'keyInvalid' || reason === 'keyExpired')
      return 'API access denied. The server admin needs to check the API key.';
    if (reason === 'ipRefererBlocked')
      return 'API key has a referrer/IP restriction that blocks this server.';
    return 'API access denied. The server admin needs to check the API key.';
  }
  if (status === 429) return 'Rate limit reached. Try again in a moment.';
  if (status === 400) return 'Invalid request.';
  if (status === 404) return 'Not found.';
  if (status >= 500)  return 'The upstream service is unavailable right now.';
  return 'Failed to load. Check your connection.';
}

// In-flight de-duplication: identical concurrent requests share ONE network
// call. Infinite scroll + re-renders were firing the same search 3x at once,
// which (a) burned 3x the daily quota and (b) tripped Google's short-window
// rate limit. Coalescing collapses those bursts to a single upstream call.
const inflight = new Map();
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function isRateLimited(status, reason) {
  return status === 429
    || (status === 403 && (reason === 'rateLimitExceeded'
      || reason === 'userRateLimitExceeded' || reason === 'userRateLimitExceededUnreg'));
}

/**
 * Fetch from the proxied YouTube Data API v3.
 * Returns response in YouTube's native shape — no translation needed.
 *
 * De-dupes concurrent identical requests and retries transient rate limits with
 * a short backoff. The caller's AbortSignal is intentionally NOT forwarded to
 * the network: once a request reaches Google the quota is already spent, so
 * cancelling saves nothing, and forwarding it would let one caller cancel a
 * coalesced request out from under the others. Hooks guard stale results
 * themselves (generation/abort checks).
 *
 * @param {string} path  e.g. "search?part=snippet&q=New"
 * @param {{ signal?: AbortSignal, noCache?: boolean }} [opts]
 */
export async function fetchApi(path, opts = {}) {
  if (!opts.noCache) {
    const hit = cacheGet(path);
    if (hit) return hit;
    const pending = inflight.get(path);
    if (pending) return pending;
  }

  const run = (async () => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const res = await http.get(path);
        cacheSet(path, res.data);
        return res.data;
      } catch (err) {
        if (axios.isCancel(err) || err.name === 'CanceledError') throw err;
        const status = err?.response?.status;
        const reason = googleReasonOf(err);
        // Transient rate limit → brief backoff + retry (the per-window limit
        // clears in a moment). Never retry quota/auth/4xx — they won't recover.
        if (isRateLimited(status, reason) && attempt < 3) {
          await sleep(700 * attempt + Math.floor(Math.random() * 400));
          continue;
        }
        throw new ApiError(friendlyMessageFor(status, reason), { status, cause: err, googleReason: reason });
      }
    }
  })();

  if (!opts.noCache) {
    inflight.set(path, run);
    const clear = () => { if (inflight.get(path) === run) inflight.delete(path); };
    run.then(clear, clear);
  }
  return run;
}

const VIDEO_ID_RE = /^[\w-]{11}$/;

/**
 * Batch-fetch contentDetails + statistics for video ids.
 * The search endpoint only returns `snippet` (no duration, no view count), so
 * cards look bare. videos.list fills that in for a flat 1 quota unit per 50 ids
 * — a tiny cost next to search's 100. Returns a map of { videoId -> videoItem }.
 *
 * @param {string[]} ids
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchVideoMeta(ids, opts = {}) {
  const clean = [...new Set((ids || []).filter((x) => VIDEO_ID_RE.test(x)))];
  const out = {};
  for (let i = 0; i < clean.length; i += 50) {
    const chunk = clean.slice(i, i + 50);
    const data = await fetchApi(
      `videos?part=contentDetails,statistics&id=${chunk.join(',')}&maxResults=50`,
      { signal: opts.signal }
    );
    for (const v of data?.items || []) out[v.id] = v;
  }
  return out;
}

// Back-compat shim.
export const ApiService = { fetching: (url) => fetchApi(url) };
