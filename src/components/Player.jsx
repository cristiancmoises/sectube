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

function fmt(t) {
  if (!Number.isFinite(t)) return '0:00';
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  const pad = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function Player({ videoId }) {
  const containerId = `yt-player-${videoId || 'none'}`;
  const wrapRef = useRef(null);
  const playerRef = useRef(null);
  const tickRef = useRef(null);
  const hideTimerRef = useRef(null);

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
    let cancelled = false;
    let p = null;

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (cancelled) return;
        p = new YT.Player(containerId, {
          videoId: safeId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            controls: 0,        // we render our own
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,  // no annotations
            playsinline: 1,
            disablekb: 1,
            fs: 0,              // we provide fullscreen, not YT's
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setDuration(p.getDuration() || 0);
              setVolume(p.getVolume());
              setMuted(p.isMuted());
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
              const msg = code === 100 ? 'Video not found or made private.'
                       : code === 101 || code === 150 ? 'Embedding disabled by uploader.'
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
    };
  }, [safeId, containerId]);

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

  const setVol = (e) => {
    const p = playerRef.current;
    if (!p) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const v = Math.round(ratio * 100);
    p.setVolume(v);
    setVolume(v);
    if (v > 0 && muted) { p.unMute(); setMuted(false); }
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) { p.unMute(); setMuted(false); }
    else       { p.mute();   setMuted(true);  }
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
      <div id={containerId} className="player-iframe" />
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
          <Tooltip title={playing ? 'Pause' : 'Play'}>
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

          <Tooltip title={muted ? 'Unmute' : 'Mute'}>
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
          <Tooltip title={isFs ? 'Exit fullscreen' : 'Fullscreen'}>
            <button className="player-btn" onClick={toggleFs} aria-label={isFs ? 'Exit fullscreen' : 'Fullscreen'} data-active={isFs}>
              {isFs ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
            </button>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
