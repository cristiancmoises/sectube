// Regional content preferences applied to every outbound YouTube API call.
// YouTube Data v3 honors these on the `search` endpoint:
//   regionCode          ISO 3166-1 alpha-2  (e.g. "JP", "US", "BR")
//   relevanceLanguage   ISO 639-1           (e.g. "ja", "en", "pt")

export const COUNTRIES = [
  { code: 'JP', label: 'Japan',          lang: 'ja' },
  { code: 'US', label: 'United States',  lang: 'en' },
  { code: 'GB', label: 'United Kingdom', lang: 'en' },
  { code: 'DE', label: 'Germany',        lang: 'de' },
  { code: 'FR', label: 'France',         lang: 'fr' },
  { code: 'BR', label: 'Brazil',         lang: 'pt' },
  { code: 'IN', label: 'India',          lang: 'en' },
  { code: 'KR', label: 'Korea',          lang: 'ko' },
  { code: 'ES', label: 'Spain',          lang: 'es' },
  { code: 'IT', label: 'Italy',          lang: 'it' },
  { code: 'CA', label: 'Canada',         lang: 'en' },
  { code: 'AU', label: 'Australia',      lang: 'en' },
];

export const DEFAULT_REGION = 'JP';
export const DEFAULT_CATEGORY = 'New';
export const REGION_KEY = 'sectube.region';

/** Read stored region code; fall back to DEFAULT_REGION. */
export function getStoredRegion() {
  try {
    const v = localStorage.getItem(REGION_KEY);
    if (v && COUNTRIES.some((c) => c.code === v)) return v;
  } catch { /* private mode */ }
  return DEFAULT_REGION;
}

export function setStoredRegion(code) {
  if (!COUNTRIES.some((c) => c.code === code)) return;
  try { localStorage.setItem(REGION_KEY, code); } catch { /* ignore */ }
}

export function languageFor(code) {
  const c = COUNTRIES.find((x) => x.code === code);
  return c ? c.lang : 'en';
}

/**
 * Build a /search URL with regional bias baked in.
 * Region is read live from storage so any change propagates without a reload.
 */
export function buildSearchUrl(query, extra = {}, { regional = true } = {}) {
  const params = new URLSearchParams({ part: 'snippet', q: query, ...extra });
  if (regional) {
    const region = getStoredRegion();
    const lang = languageFor(region);
    if (region) params.set('regionCode', region);
    if (lang) params.set('relevanceLanguage', lang);
  }
  return `search?${params.toString()}`;
}

export function buildApiUrl(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return `${endpoint}?${qs}`;
}
