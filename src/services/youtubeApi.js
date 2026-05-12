// Singleton loader for YouTube's IFrame Player API.
// YT.Player can only be constructed after YT.ready fires.

let loadPromise = null;

export function loadYouTubeIframeAPI() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const prevHook = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevHook === 'function') {
        try { prevHook(); } catch { /* ignore */ }
      }
      resolve(window.YT);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
    document.head.appendChild(tag);
  });

  return loadPromise;
}
