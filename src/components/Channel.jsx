import { useEffect, useState, useCallback } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import VideoCard from './VideoCard.jsx';
import ChannelCard from './ChannelCard.jsx';
import { Loader, ErrorPanel, EmptyState } from './Loader.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { fetchApi } from '../services/api.js';

const CHANNEL_ID_RE = /^[\w-]{6,64}$/;

const TABS = [
  { id: 'videos',    label: 'Videos' },
  { id: 'shorts',    label: 'Shorts' },
  { id: 'live',      label: 'Live' },
  { id: 'playlists', label: 'Playlists' },
];

/**
 * Heuristic: a Shorts video has a portrait thumbnail aspect.
 * The API doesn't expose a Shorts flag; we approximate by thumbnail shape.
 */
function isShortByThumb(item) {
  const t = item?.snippet?.thumbnails?.high || item?.snippet?.thumbnails?.medium;
  if (!t?.width || !t?.height) return false;
  return t.height > t.width;
}

/**
 * Generic paged fetcher built on the search endpoint.
 * Stops when the API stops returning a nextPageToken (API caps ~500 items).
 */
function usePagedSearch(baseUrl) {
  const [items, setItems] = useState([]);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exhausted, setExhausted] = useState(false);

  const reset = useCallback(() => {
    setItems([]); setToken(null); setError(null); setExhausted(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || exhausted || !baseUrl) return;
    setLoading(true); setError(null);
    try {
      const url = token ? `${baseUrl}&pageToken=${encodeURIComponent(token)}` : baseUrl;
      const data = await fetchApi(url);
      const newItems = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => prev.concat(newItems));
      const next = data?.nextPageToken;
      setToken(next || null);
      if (!next) setExhausted(true);
    } catch (e) {
      if (e.name !== 'CanceledError') setError(e);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, token, loading, exhausted]);

  // Auto-load on first mount / url change.
  useEffect(() => {
    reset();
  }, [baseUrl, reset]);

  useEffect(() => {
    // Fire initial load after reset cleared state.
    if (!baseUrl) return;
    if (items.length === 0 && !exhausted && !loading) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  return { items, loading, error, exhausted, loadMore };
}

export default function Channel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const safeId = id && CHANNEL_ID_RE.test(id) ? id : '';
  const [tab, setTab] = useState('videos');

  const {
    data: channelData, error: channelErr,
    loading: channelLoading, refetch: refetchChannel,
  } = useFetch(safeId ? `channels?part=snippet,statistics,brandingSettings&id=${safeId}` : null);

  // Channel uploads (used by Videos + Shorts tabs; filtered client-side).
  const videosUrl = safeId
    ? `search?channelId=${safeId}&part=snippet,id&order=date&type=video&maxResults=50`
    : null;

  // Live broadcasts.
  const liveUrl = safeId
    ? `search?channelId=${safeId}&part=snippet,id&order=date&type=video&eventType=live&maxResults=50`
    : null;

  // Playlists.
  const playlistsUrl = safeId
    ? `playlists?channelId=${safeId}&part=snippet,contentDetails&maxResults=50`
    : null;

  const videosPager    = usePagedSearch(tab === 'videos' || tab === 'shorts' ? videosUrl : null);
  const livePager      = usePagedSearch(tab === 'live'     ? liveUrl     : null);
  const playlistsPager = usePagedSearch(tab === 'playlists' ? playlistsUrl : null);

  if (!safeId) return <ErrorPanel error={{ message: 'Invalid channel id.' }} />;

  const channelDetail = channelData?.items?.[0];
  const banner = channelDetail?.brandingSettings?.image?.bannerExternalUrl;

  // Filter the videos pager differently per tab.
  const filteredVideos = tab === 'shorts'
    ? videosPager.items.filter(isShortByThumb)
    : tab === 'videos'
      ? videosPager.items.filter((v) => !isShortByThumb(v))
      : videosPager.items;

  const activePager =
    tab === 'live'      ? livePager :
    tab === 'playlists' ? playlistsPager :
                          videosPager;

  return (
    <Box className="page" sx={{ pt: 0, px: 0 }}>
      <Box sx={{
        width: '100%',
        height: { xs: 140, md: 220 },
        backgroundImage: banner
          ? `linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 100%), url(${banner})`
          : 'linear-gradient(180deg, var(--c-primary-faint) 0%, rgba(0,0,0,1) 100%)',
        backgroundColor: '#040707',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        borderBottom: '1px solid var(--c-border)',
        position: 'relative',
      }}>
        <Tooltip title="Back">
          <IconButton
            onClick={() => navigate(-1)}
            aria-label="Back"
            sx={{
              position: 'absolute', top: 12, left: 12,
              bgcolor: 'rgba(0,0,0,0.6)',
              border: '1px solid var(--c-border)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <ArrowBack fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ px: { xs: 2, md: 3 }, maxWidth: 1500, mx: 'auto' }}>
        {channelLoading && <Loader count={4} />}
        {channelErr && <ErrorPanel error={channelErr} onRetry={refetchChannel} />}
        {channelDetail && <ChannelCard video={channelDetail} marginTop="-90px" />}

        <Box className="tabs" role="tablist" sx={{ mt: 3 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              className="tab"
              aria-selected={tab === t.id}
              aria-controls={`tab-panel-${t.id}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </Box>

        <Box role="tabpanel" id={`tab-panel-${tab}`} sx={{ mt: 2 }}>
          {tab === 'playlists' ? (
            <>
              {activePager.loading && filteredVideos.length === 0 && <Loader count={4} />}
              {activePager.error && <ErrorPanel error={activePager.error} />}
              {!activePager.loading && playlistsPager.items.length === 0 && <EmptyState message="No playlists." />}
              <div className="grid">
                {playlistsPager.items.map((p) => {
                  const plId = p.id;
                  const snippet = p.snippet;
                  const thumb = snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || '';
                  return (
                    <a
                      key={plId}
                      href={`https://www.youtube.com/playlist?list=${plId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-link"
                    >
                      <Box sx={{ position: 'relative', bgcolor: '#111' }}>
                        <Box component="img" src={thumb} alt="" loading="lazy"
                          sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                        <span className="duration-badge">
                          {p.contentDetails?.itemCount ?? '?'} items
                        </span>
                      </Box>
                      <Box sx={{ p: 1.25 }}>
                        <Typography sx={{ color: 'var(--c-text)', fontWeight: 600, fontSize: 14 }}>
                          {snippet?.title}
                        </Typography>
                      </Box>
                    </a>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {activePager.loading && filteredVideos.length === 0 && <Loader count={8} />}
              {activePager.error && <ErrorPanel error={activePager.error} />}
              {!activePager.loading && filteredVideos.length === 0 && (
                <EmptyState message={
                  tab === 'live'   ? 'No live broadcasts right now.'
                : tab === 'shorts' ? 'No Shorts found for this channel.'
                                   : 'No videos.'
                } />
              )}
              <div className={`grid ${tab === 'shorts' ? 'grid--shorts' : ''}`}>
                {filteredVideos.map((v, i) => (
                  <Box key={(v.id?.videoId || v.id) + '-' + i}>
                    <VideoCard video={v} />
                  </Box>
                ))}
              </div>
            </>
          )}

          <Stack direction="row" justifyContent="center" sx={{ mt: 4 }}>
            {!activePager.exhausted && !activePager.loading && activePager.items.length > 0 && (
              <Button variant="outlined" onClick={activePager.loadMore}>
                Load more
              </Button>
            )}
            {activePager.loading && activePager.items.length > 0 && (
              <Typography sx={{ color: 'var(--c-text-dim)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                Loading…
              </Typography>
            )}
            {activePager.exhausted && activePager.items.length > 0 && (
              <Typography sx={{ color: 'var(--c-text-faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                — END · {activePager.items.length} items · YouTube caps search at ~500 —
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
