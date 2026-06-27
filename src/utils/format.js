import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

dayjs.extend(relativeTime);

/** Human relative time ("2 days ago"). Safe on null/undefined. */
export function timeFromNow(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isValid() ? d.fromNow() : '';
}

export function formatCount(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString();
}

/**
 * Compact-format a number for badges (e.g. 1234 → "1.2K", 1500000 → "1.5M").
 * Uses Intl.NumberFormat with "compact" notation; falls back gracefully if
 * the runtime lacks support.
 */
export function compactCount(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  try {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
  } catch {
    return num.toLocaleString();
  }
}

/**
 * Parse ISO-8601 duration (PT4M13S) into total seconds. Returns 0 when absent
 * or unparseable. YouTube Data v3 `contentDetails.duration` ships in this format.
 */
export function durationSeconds(iso) {
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

/**
 * Parse ISO-8601 duration (PT4M13S) into "4:13" or "1:02:03".
 */
export function formatDuration(iso) {
  const total = durationSeconds(iso);
  if (!total) return '';
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}
