import { useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import VideoCard from './VideoCard.jsx';
import ChannelCard from './ChannelCard.jsx';
import InfiniteSentinel from './InfiniteSentinel.jsx';
import { Loader, ErrorPanel, EmptyState, FeedStatus } from './Loader.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { usePagedVideos } from '../hooks/usePagedVideos.js';
import { durationSeconds } from '../utils/format.js';

const CHANNEL_ID_RE = /^[\w-]{6,64}$/;
const SHORT_MAX_SECONDS = 60;

const TABS = [
  { id: 'videos',    label: 'Videos' },
  { id: 'shorts',    label: 'Shorts' },
  { id: 'live',      label: 'Live' },
  { id: 'playlists', label: 'Playlists' },
];

/**
 * Heuristic: the Data API exposes no Shorts flag, and thumbnails are always
 * reported landscape even for Shorts — so we approximate by duration once the
 * item is hydrated (≤60s = Short). Unhydrated items (no contentDetails yet)
 * return 0 and are treated as regular videos until hydration fills them in.
 */
function isShort(item) {
  const sec = durationSeconds(item?.contentDetails?.duration);
  return sec > 0 && sec <= SHORT_MAX_SECONDS;
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

  // Channel uploads (Videos + Shorts tabs share this; filtered client-side).
  const videosUrl = safeId
    ? `search?channelId=${safeId}&part=snippet,id&order=date&type=video&maxResults=50`
    : null;
  const liveUrl = safeId
    ? `search?channelId=${safeId}&part=snippet,id&order=date&type=video&eventType=live&maxResults=50`
    : null;
  const playlistsUrl = safeId
    ? `playlists?channelId=${safeId}&part=snippet,contentDetails&maxResults=50`
    : null;

  const videosPager    = usePagedVideos((tab === 'videos' || tab === 'shorts') ? videosUrl : null);
  const livePager      = usePagedVideos(tab === 'live' ? liveUrl : null);
  const playlistsPager = usePagedVideos(tab === 'playlists' ? playlistsUrl : null,
    { hydrate: false, normalize: false });

  if (!safeId) return <ErrorPanel error={{ message: 'Invalid channel id.' }} />;

  const channelDetail = channelData?.items?.[0];
  const banner = channelDetail?.brandingSettings?.image?.bannerExternalUrl;

  const filteredVideos = tab === 'shorts'
    ? videosPager.items.filter(isShort)
    : tab === 'videos'
      ? videosPager.items.filter((v) => !isShort(v))
      : videosPager.items;

  const activePager =
    tab === 'live'      ? livePager :
    tab === 'playlists' ? playlistsPager :
                          videosPager;
  const sentinelDisabled = activePager.loading || activePager.exhausted || Boolean(activePager.error);

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
              {activePager.loading && playlistsPager.items.length === 0 && <Loader count={4} />}
              {activePager.error && playlistsPager.items.length === 0 && <ErrorPanel error={activePager.error} onRetry={activePager.loadMore} />}
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
                        <Box component="img" src={thumb} alt="" loading="lazy" decoding="async"
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
              {activePager.items.length === 0 && activePager.loading && <Loader count={8} />}
              {activePager.error && activePager.items.length === 0 && <ErrorPanel error={activePager.error} onRetry={activePager.loadMore} />}
              {/* Empty only once the pager is fully drained and this tab's filter
                  still matched nothing — Shorts filters most uploads out, so
                  judging emptiness mid-stream would flash a false "none". */}
              {activePager.exhausted && filteredVideos.length === 0 && !activePager.error && (
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

          <FeedStatus
            loading={activePager.loading}
            error={activePager.items.length > 0 ? activePager.error : null}
            exhausted={activePager.exhausted}
            count={activePager.items.length}
            onRetry={activePager.loadMore}
          />
          <InfiniteSentinel onLoadMore={activePager.loadMore} disabled={sentinelDisabled} />
        </Box>
      </Box>
    </Box>
  );
}
