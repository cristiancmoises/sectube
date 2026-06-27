import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApi, fetchVideoMeta } from '../services/api.js';

const END = '__END__';

/**
 * Normalize an item to the search shape every card expects:
 *   { id: { videoId | channelId }, snippet, contentDetails?, statistics? }
 *
 * search/* already uses that nested-id shape. videos.list (mostPopular) and
 * playlistItems use a flat string id, so we wrap it.
 */
export function normalizeItem(it) {
  if (!it) return null;
  if (it.id && typeof it.id === 'object') return it; // already search shape
  const kind = it.kind || it.id?.kind;
  if (typeof it.id === 'string') {
    if (kind === 'youtube#channel') return { ...it, id: { channelId: it.id } };
    // playlistItems / videos.list both key the video id differently:
    const videoId = it.snippet?.resourceId?.videoId || it.contentDetails?.videoId || it.id;
    return { ...it, id: { videoId } };
  }
  return it;
}

/**
 * Merge contentDetails + statistics into items that have a video id but no
 * stats yet (i.e. came from search). Items that already carry contentDetails
 * (mostPopular, hydrated) are left untouched, so trending pages do zero extra
 * calls. Failures degrade gracefully — cards just render without duration/views.
 */
async function hydrate(items, signal) {
  const need = items.filter((it) => it?.id?.videoId && !it.contentDetails);
  if (need.length === 0) return items;
  const map = await fetchVideoMeta(need.map((it) => it.id.videoId), { signal });
  if (Object.keys(map).length === 0) return items;
  return items.map((it) => {
    const v = it?.id?.videoId && map[it.id.videoId];
    if (!v) return it;
    return { ...it, contentDetails: v.contentDetails, statistics: v.statistics };
  });
}

/**
 * Infinite-scroll pager over any list endpoint that supports nextPageToken
 * (search, videos?chart=mostPopular, playlistItems, …).
 *
 * @param {string|null} baseUrl  the first-page URL (no pageToken)
 * @param {{ hydrate?: boolean, normalize?: boolean }} [opts]
 * @returns {{ items, loading, error, exhausted, loadMore }}
 */
export function usePagedVideos(baseUrl, { hydrate: doHydrate = true, normalize = true } = {}) {
  const [state, setState] = useState({
    items: [], loading: Boolean(baseUrl), error: null, exhausted: false,
  });
  const tokenRef = useRef(null);     // next pageToken, or END sentinel
  const loadingRef = useRef(false);  // guards against concurrent loads
  const genRef = useRef(0);          // bumped on baseUrl change to drop stale work
  const acRef = useRef(null);        // in-flight AbortController

  const loadMore = useCallback(async () => {
    if (!baseUrl || loadingRef.current || tokenRef.current === END) return;
    loadingRef.current = true;
    const gen = genRef.current;
    const ac = new AbortController();
    acRef.current = ac;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tok = tokenRef.current;
      const url = tok ? `${baseUrl}&pageToken=${encodeURIComponent(tok)}` : baseUrl;
      const data = await fetchApi(url, { signal: ac.signal });
      let items = (Array.isArray(data?.items) ? data.items : []).filter(Boolean);
      if (normalize) items = items.map(normalizeItem).filter(Boolean);
      if (doHydrate) {
        try { items = await hydrate(items, ac.signal); } catch { /* keep unhydrated */ }
      }
      // Drop videos whose uploader disallows embedding — they can't play in-app.
      // Only feeds that request part=status carry the flag (e.g. trending home);
      // everywhere else `status` is undefined and nothing is filtered.
      items = items.filter((it) => it?.status?.embeddable !== false);
      if (gen !== genRef.current || ac.signal.aborted) return; // stale/cancelled
      const next = data?.nextPageToken || null;
      tokenRef.current = next || END;
      setState((s) => ({
        items: s.items.concat(items),
        loading: false,
        error: null,
        exhausted: !next,
      }));
    } catch (e) {
      if (gen !== genRef.current || ac.signal.aborted) return;
      if (e?.name !== 'CanceledError') {
        setState((s) => ({ ...s, loading: false, error: e }));
      }
    } finally {
      loadingRef.current = false;
    }
  }, [baseUrl, doHydrate, normalize]);

  // Reset + initial load whenever the base URL changes. The cleanup aborts any
  // in-flight load — this both cancels stale fetches on navigation/unmount and
  // makes the hook safe under React 18 StrictMode's double-invoked effects.
  useEffect(() => {
    genRef.current += 1;
    tokenRef.current = null;
    loadingRef.current = false;
    setState({ items: [], loading: Boolean(baseUrl), error: null, exhausted: false });
    if (baseUrl) loadMore();
    return () => { acRef.current?.abort(); };
    // loadMore is stable per baseUrl; re-running on its identity would double-load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  return { ...state, loadMore };
}
