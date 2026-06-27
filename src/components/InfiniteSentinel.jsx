import { useEffect, useRef } from 'react';

/**
 * Invisible sentinel that calls `onLoadMore` when it scrolls into view.
 * `rootMargin` pre-fires before the user hits the very bottom so the next page
 * is usually ready by the time they get there. `disabled` (loading/exhausted)
 * tears the observer down so we never queue overlapping loads.
 */
export default function InfiniteSentinel({ onLoadMore, disabled = false, rootMargin = '900px' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (disabled) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) onLoadMore(); },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onLoadMore, disabled, rootMargin]);

  return <div ref={ref} aria-hidden="true" style={{ height: 1, width: '100%' }} />;
}
