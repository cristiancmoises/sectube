import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import DOMPurify from 'dompurify';

dayjs.extend(relativeTime);

/** Human relative time ("2 days ago"). Safe on null/undefined. */
export function timeFromNow(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isValid() ? d.fromNow() : '';
}

/**
 * Sanitize a YouTube description for safe rendering.
 * Whitelist-only: br, p, a (http/https only, rel hardened).
 * Returns an object safe to pass to dangerouslySetInnerHTML.
 */
export function sanitizeDescription(raw) {
  if (!raw) return { __html: '' };
  // YouTube descriptions come as plain text; convert newlines to <br> first.
  const withBreaks = String(raw).replace(/\r\n|\r|\n/g, '<br>');
  const clean = DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS: ['br', 'p', 'a'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
  // Harden all links added back after sanitize: DOMPurify already drops
  // non-http(s) hrefs; we additionally force safe rel/target via a hook.
  return { __html: clean };
}

// DOMPurify hook: add rel="noopener noreferrer nofollow" + target=_blank to all <a>.
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
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
 * Parse ISO-8601 duration (PT4M13S) into "4:13" or "1:02:03". YouTube Data v3
 * `contentDetails.duration` ships in this format.
 */
export function formatDuration(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return '';
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const sec = Number(m[3] || 0);
  const pad = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}
