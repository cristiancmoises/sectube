import DOMPurify from 'dompurify';

// DOMPurify hook: force safe rel/target on every sanitized <a>.
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

/**
 * Sanitize a YouTube description for safe rendering.
 * Whitelist-only: br, p, a (http/https only, rel hardened).
 * Returns an object safe to pass to dangerouslySetInnerHTML.
 *
 * Kept in its own module (not utils/format.js) so DOMPurify is only pulled into
 * the lazily-loaded VideoDetail chunk, never the landing bundle.
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
  return { __html: clean };
}
