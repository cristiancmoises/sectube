import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Tooltip, IconButton } from '@mui/material';
import {
  PlayArrow, Pause, VolumeUp, VolumeOff, Fullscreen, FullscreenExit,
  PictureInPictureAlt, Replay, OpenInNew,
} from '@mui/icons-material';
import { loadYouTubeIframeAPI } from '../services/youtubeApi.js';

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// YT.PlayerState constants — defined explicitly because YT.PlayerState
// isn't always available at module-load time.
const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

// Persist volume/mute across videos and sessions (no quota, pure UX).
const VOL_KEY = 'sectube.volume';
const MUTE_KEY = 'sectube.muted';
function loadVol() {
  try { const v = Number(localStorage.getItem(VOL_KEY)); return Number.isFinite(v) && v >= 0 && v <= 100 ? v : null; }
  catch { return null; }
}
function loadMuted() { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } }
function saveVol(v) { try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* private mode */ } }
function saveMuted(m) { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* private mode */ } }
const clampVol = (v) => Math.max(0, Math.min(100, Math.round(v)));

function fmt(t) {
  if (!Number.isFinite(t)) return '0:00';
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  const pad = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function Player({ videoId }) {
  const wrapRef = useRef(null);
  const hostRef = useRef(null);   // React-owned div; YT's iframe lives INSIDE it
  const playerRef = useRef(null);
  const tickRef = useRef(null);
  const hideTimerRef = useRef(null);
  const retryRef = useRef(0);     // spurious-error-150 retry counter

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isFs, setIsFs] = useState(false);
  const [active, setActive] = useState(true); // overlay visibility
  const [error, setError] = useState(null);

  const safeId = videoId && VIDEO_ID_RE.test(videoId) ? videoId : '';

  // ---- Initialize YT player ------------------------------------------------
  useEffect(() => {
    if (!safeId) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    let p = null;
    retryRef.current = 0;

    // Create a throwaway node OUTSIDE React's control for the YT API to replace
    // with its <iframe>. React owns `host` (which has no JSX children), so it
    // never tries to reconcile/remove the YT-mutated node — this is what avoids
    // the "removeChild: node is not a child" crash when the player errors or the
    // route unmounts. (Passing a React-rendered element to new YT.Player() lets
    // YT replace a node React still thinks it owns → crash.)
    host.textContent = '';
    const mount = document.createElement('div');
    mount.style.width = '100%';
    mount.style.height = '100%';
    host.appendChild(mount);

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (cancelled) return;
        p = new YT.Player(mount, {
          videoId: safeId,
          // Standard host (not nocookie): the privacy host is bot-walled more
          // aggressively. `origin` lets YouTube verify the embedding page, which
          // also reduces spurious "confirm you're not a bot" interstitials.
          host: 'https://www.youtube.com',
          playerVars: {
            controls: 0,        // we render our own
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,  // no annotations
            playsinline: 1,
            disablekb: 1,
            fs: 0,              // we provide fullscreen, not YT's
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setDuration(p.getDuration() || 0);
              // Restore the viewer's last volume/mute instead of YT's default.
              const sv = loadVol();
              if (sv != null) { p.setVolume(sv); setVolume(sv); } else { setVolume(p.getVolume()); }
              if (loadMuted()) { p.mute(); setMuted(true); } else { setMuted(p.isMuted()); }
            },
            onStateChange: (e) => {
              if (cancelled) return;
              setPlaying(e.data === STATE.PLAYING);
              setEnded(e.data === STATE.ENDED);
              if (e.data === STATE.PLAYING || e.data === STATE.PAUSED) {
                setDuration(p.getDuration() || 0);
              }
            },
            onError: (e) => {
              if (cancelled) return;
              const code = e.data;
              // 101/150 ("embedding disabled") is frequently a spurious first-load
              // hiccup on videos that are actually embeddable — retry a couple of
              // times before giving up so we don't wrongly block playable videos.
              if ((code === 101 || code === 150) && retryRef.current < 2) {
                retryRef.current += 1;
                setTimeout(() => {
                  if (cancelled) return;
                  try { p.loadVideoById(safeId); } catch { /* ignore */ }
                }, 700);
                return;
              }
              const msg = code === 100 ? 'Video not found or made private.'
                       : code === 101 || code === 150 ? 'Embedding disabled by the uploader. Open it on YouTube instead.'
                       : code === 2 ? 'Invalid video id.'
                       : 'Playback error.';
              setError(msg);
            },
          },
        });
        playerRef.current = p;
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load YouTube player.');
      });

    // Tick for progress
    tickRef.current = setInterval(() => {
      const cur = playerRef.current;
      if (!cur || typeof cur.getCurrentTime !== 'function') return;
      try { setCurrent(cur.getCurrentTime() || 0); } catch { /* destroyed */ }
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(tickRef.current);
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
      // Drop any iframe YT left behind. Safe because React tracks no children
      // for `host`, so emptying it is invisible to the reconciler.
      try { host.textContent = ''; } catch { /* ignore */ }
    };
  }, [safeId]);

  // ---- Fullscreen tracking -------------------------------------------------
  useEffect(() => {
    const handler = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ---- Auto-hide overlay on inactivity ------------------------------------
  const poke = useCallback(() => {
    setActive(true);
    clearTimeout(hideTimerRef.current);
    if (playerRef.current && playing) {
      hideTimerRef.current = setTimeout(() => setActive(false), 2500);
    }
  }, [playing]);

  useEffect(() => { poke(); }, [poke, playing]);

  // ---- Keyboard shortcuts --------------------------------------------------
  // Standard player keys, ignored while typing in a field. Reads live state
  // from the YT API so there are no stale-closure surprises.
  useEffect(() => {
    function onKey(e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      const dur = p.getDuration?.() || 0;
      const cur = p.getCurrentTime?.() || 0;
      const seekBy = (d) => { const nt = Math.max(0, Math.min(dur || cur + d, cur + d)); p.seekTo(nt, true); setCurrent(nt); poke(); };
      const volBy = (d) => {
        const v = clampVol((p.getVolume?.() || 0) + d);
        p.setVolume(v); setVolume(v); saveVol(v);
        if (v > 0 && p.isMuted?.()) { p.unMute(); setMuted(false); saveMuted(false); }
        poke();
      };
      switch (e.key) {
        case ' ': case 'k': {
          e.preventDefault();
          const st = p.getPlayerState?.();
          if (st === STATE.ENDED) { p.seekTo(0, true); p.playVideo(); }
          else if (st === STATE.PLAYING) p.pauseVideo();
          else p.playVideo();
          poke();
          break;
        }
        case 'ArrowLeft':  e.preventDefault(); seekBy(-5);  break;
        case 'ArrowRight': e.preventDefault(); seekBy(5);   break;
        case 'j': seekBy(-10); break;
        case 'l': seekBy(10);  break;
        case 'ArrowUp':   e.preventDefault(); volBy(5);  break;
        case 'ArrowDown': e.preventDefault(); volBy(-5); break;
        case 'm':
          if (p.isMuted?.()) { p.unMute(); setMuted(false); saveMuted(false); }
          else { p.mute(); setMuted(true); saveMuted(true); }
          poke();
          break;
        case 'f': {
          const el = wrapRef.current;
          if (!el) break;
          if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
          else document.exitFullscreen?.().catch(() => {});
          break;
        }
        default:
          if (e.key >= '0' && e.key <= '9' && dur) {
            e.preventDefault();
            const nt = (Number(e.key) / 10) * dur;
            p.seekTo(nt, true); setCurrent(nt); poke();
          }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [poke]);

  // ---- Controls ------------------------------------------------------------
  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (ended) { p.seekTo(0, true); p.playVideo(); return; }
    if (playing) p.pauseVideo(); else p.playVideo();
  };

  const seek = (e) => {
    const p = playerRef.current;
    if (!p || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    p.seekTo(ratio * duration, true);
    setCurrent(ratio * duration);
  };

  // Single source of truth for setting volume — used by the slider and the
  // keyboard arrows. Unmutes when raised, and persists the choice.
  const applyVolume = (raw) => {
    const p = playerRef.current;
    if (!p) return;
    const v = clampVol(raw);
    p.setVolume(v);
    setVolume(v);
    saveVol(v);
    if (v > 0 && p.isMuted?.()) { p.unMute(); setMuted(false); saveMuted(false); }
  };

  const setVol = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    applyVolume((x / rect.width) * 100);
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted?.()) { p.unMute(); setMuted(false); saveMuted(false); }
    else               { p.mute();   setMuted(true);  saveMuted(true);  }
  };

  const toggleFs = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const togglePip = async () => {
    // PiP requires the YouTube embed to be in a state where it exposes the
    // underlying <video> element. YT's iframe sandboxes that; we offer this
    // as a best-effort: ask the browser; if it 404s, no-op.
    try {
      const iframe = wrapRef.current?.querySelector('iframe');
      // No reliable way to reach into a cross-origin iframe's <video> element.
      // Fallback: open YouTube in a new tab for native PiP there.
      if (!iframe) return;
      window.open(`https://www.youtube.com/watch?v=${safeId}`, '_blank', 'noopener,noreferrer');
    } catch { /* ignore */ }
  };

  if (!safeId) {
    return <Box className="player-wrap"><Box sx={{ p: 4, color: 'var(--c-error)' }}>Invalid video id.</Box></Box>;
  }

  if (error) {
    return (
      <Box className="player-wrap" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ color: 'var(--c-error)', fontFamily: 'var(--mono)' }}>{error}</Box>
        <IconButton
          component="a"
          href={`https://www.youtube.com/watch?v=${safeId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open on YouTube"
          sx={{ border: '1px solid var(--c-border)' }}
        >
          <OpenInNew />
        </IconButton>
      </Box>
    );
  }

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <Box
      ref={wrapRef}
      className="player-wrap"
      onMouseMove={poke}
      onMouseEnter={poke}
      onMouseLeave={() => playing && setActive(false)}
      onTouchStart={poke}
    >
      <div ref={hostRef} className="player-iframe" />
      {/* Always-reachable escape: if the embed is bot-walled or won't start, the
          viewer can still jump to YouTube with one tap. Hidden during playback. */}
      {!playing && (
        <a
          className="yt-escape"
          href={`https://www.youtube.com/watch?v=${safeId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Watch on YouTube"
        >
          <OpenInNew sx={{ fontSize: 14 }} /> YouTube
        </a>
      )}
      <Box className={`player-overlay ${active ? 'is-active' : ''}`}>
        {/* Center play-pause overlay (visible when paused) */}
        {ready && !playing && !ended && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto',
          }}>
            <Tooltip title="Play" enterDelay={300}>
              <button className="player-btn" onClick={togglePlay} aria-label="Play"
                style={{ width: 64, height: 64, borderColor: 'var(--c-border-hi)' }}>
                <PlayArrow style={{ fontSize: 36 }} />
              </button>
            </Tooltip>
          </Box>
        )}
        {ended && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto',
          }}>
            <Tooltip title="Replay" enterDelay={300}>
              <button className="player-btn" onClick={togglePlay} aria-label="Replay"
                style={{ width: 64, height: 64, borderColor: 'var(--c-border-hi)' }}>
                <Replay style={{ fontSize: 36 }} />
              </button>
            </Tooltip>
          </Box>
        )}

        {/* Bottom control row */}
        <Box className="player-controls">
          <Tooltip title={`${playing ? 'Pause' : 'Play'} · space`}>
            <button className="player-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
            </button>
          </Tooltip>

          <span className="player-time">{fmt(current)} / {fmt(duration)}</span>

          <div
            className="player-scrub"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={current}
            onClick={seek}
          >
            <div className="player-scrub-fill" style={{ width: `${pct}%` }} />
            <div className="player-scrub-knob" style={{ left: `${pct}%` }} />
          </div>

          <Tooltip title={`${muted ? 'Unmute' : 'Mute'} · m`}>
            <button className="player-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted || volume === 0 ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
            </button>
          </Tooltip>

          <div
            className="player-volume"
            role="slider"
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={volume}
            onClick={setVol}
          >
            <div className="player-volume-fill" style={{ width: `${muted ? 0 : volume}%` }} />
          </div>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Picture-in-picture (opens YouTube)">
            <button className="player-btn" onClick={togglePip} aria-label="Picture-in-picture">
              <PictureInPictureAlt fontSize="small" />
            </button>
          </Tooltip>
          <Tooltip title="Open on YouTube">
            <a
              className="player-btn"
              href={`https://www.youtube.com/watch?v=${safeId}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open on YouTube"
            >
              <OpenInNew fontSize="small" />
            </a>
          </Tooltip>
          <Tooltip title={`${isFs ? 'Exit fullscreen' : 'Fullscreen'} · f`}>
            <button className="player-btn" onClick={toggleFs} aria-label={isFs ? 'Exit fullscreen' : 'Fullscreen'} data-active={isFs}>
              {isFs ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
            </button>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
