import { useMemo, useState } from 'react';
import { Avatar, Box, Chip, IconButton, Snackbar, Stack, Tooltip, Typography } from '@mui/material';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowBack, CheckCircle, FavoriteOutlined, MarkChatRead, Visibility,
  ContentCopy, OpenInNew, Share, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import Player from './Player.jsx';
import { Loader, ErrorPanel } from './Loader.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { buildSearchUrl } from '../services/region.js';
import { compactCount } from '../utils/format.js';
import { sanitizeDescription } from '../utils/sanitize.js';

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const safeId = id && VIDEO_ID_RE.test(id) ? id : '';

  const {
    data: videoData, error: videoErr, loading: videoLoading, refetch,
  } = useFetch(safeId ? `videos?part=snippet,statistics&id=${safeId}` : null);

  // "Related" via title keywords. YouTube removed the `relatedToVideoId` search
  // parameter in 2023 (it now 400s), so we approximate relatedness with a search
  // on the video's title once it has loaded.
  const firstItem = videoData?.items?.[0];
  const relatedUrl = useMemo(() => {
    const title = firstItem?.snippet?.title;
    if (!title) return null;
    const q = title.replace(/[|#].*/g, '').split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
    if (!q) return null;
    return buildSearchUrl(q, { maxResults: '24', type: 'video', videoEmbeddable: 'true' }, { regional: false });
  }, [firstItem]);
  const { data: relatedData } = useFetch(relatedUrl);

  const [descExpanded, setDescExpanded] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '' });

  if (!safeId) return <ErrorPanel error={{ message: 'Invalid video id.' }} />;
  if (videoLoading) return <Box className="page" sx={{ pt: 3 }}><Loader count={4} /></Box>;
  if (videoErr) return <ErrorPanel error={videoErr} onRetry={refetch} />;

  const videoDetail = videoData?.items?.[0];
  if (!videoDetail?.snippet) return <ErrorPanel error={{ message: 'Video not found.' }} />;

  const { snippet, statistics } = videoDetail;
  const tags = Array.isArray(snippet.tags) ? snippet.tags.slice(0, 6) : [];
  const ytUrl = `https://www.youtube.com/watch?v=${safeId}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(ytUrl);
      setSnack({ open: true, msg: 'Link copied to clipboard.' });
    } catch {
      setSnack({ open: true, msg: 'Copy failed.' });
    }
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: snippet.title, url: ytUrl }); return; }
      catch { /* user cancelled */ }
    }
    copyLink();
  }

  return (
    <Box className="page" sx={{ pt: 2 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Tooltip title="Back">
          <IconButton onClick={() => navigate(-1)} aria-label="Back"
            sx={{ border: '1px solid var(--c-border)' }}>
            <ArrowBack fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="overline" sx={{ color: 'var(--c-text-faint)', letterSpacing: '0.18em' }}>
          {'// playing'}
        </Typography>
      </Stack>

      <Box display="flex" sx={{ flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
        <Box sx={{ flex: { lg: '0 0 70%' }, minWidth: 0 }}>
          <Player videoId={safeId} />

          <Typography variant="h5" sx={{ mt: 2, color: 'var(--c-primary)' }}>
            {snippet.title}
          </Typography>

          <Stack direction="row" gap={2} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Visibility sx={{ fontSize: 16, color: 'var(--c-text-dim)' }} />
              <span className="mono-chip">{compactCount(statistics?.viewCount)} views</span>
            </Stack>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ opacity: 0.8 }}>
              <FavoriteOutlined sx={{ fontSize: 16, color: 'var(--c-text-dim)' }} />
              <span className="mono-chip">{compactCount(statistics?.likeCount)}</span>
            </Stack>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ opacity: 0.8 }}>
              <MarkChatRead sx={{ fontSize: 16, color: 'var(--c-text-dim)' }} />
              <span className="mono-chip">{compactCount(statistics?.commentCount)}</span>
            </Stack>

            <Box sx={{ flex: 1 }} />

            <Tooltip title="Copy link">
              <IconButton size="small" onClick={copyLink} aria-label="Copy link"
                sx={{ border: '1px solid var(--c-border)' }}>
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton size="small" onClick={share} aria-label="Share"
                sx={{ border: '1px solid var(--c-border)' }}>
                <Share fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open on YouTube">
              <IconButton size="small" component="a" href={ytUrl} target="_blank" rel="noopener noreferrer"
                aria-label="Open on YouTube"
                sx={{ border: '1px solid var(--c-border)' }}>
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {snippet.channelId && (
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 2 }}>
              <Link to={`/channel/${snippet.channelId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Avatar alt="" src={snippet.thumbnails?.default?.url} sx={{ width: 36, height: 36 }} />
                <Stack>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography sx={{ color: 'var(--c-text)', fontWeight: 600, fontSize: 14 }}>
                      {snippet.channelTitle}
                    </Typography>
                    <CheckCircle sx={{ fontSize: 12, color: 'var(--c-text-faint)' }} />
                  </Stack>
                </Stack>
              </Link>
            </Stack>
          )}

          {tags.length > 0 && (
            <Stack direction="row" gap={0.75} sx={{ mt: 2, flexWrap: 'wrap' }}>
              {tags.map((tag, idx) => (
                <Chip
                  key={`${tag}-${idx}`}
                  label={`#${tag}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    color: 'var(--c-text-faint)',
                    borderColor: 'var(--c-border)',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              ))}
            </Stack>
          )}

          <Box sx={{
            mt: 2.5, p: 2,
            bgcolor: 'var(--c-bg-raised)',
            border: '1px solid var(--c-border)',
            borderRadius: 1,
          }}>
            <Box component="div" sx={{
              color: 'var(--c-text-dim)', fontSize: 13, lineHeight: 1.55,
              wordBreak: 'break-word',
              maxHeight: descExpanded ? 'none' : 96,
              overflow: 'hidden', position: 'relative',
            }} dangerouslySetInnerHTML={sanitizeDescription(snippet.description)} />
            {snippet.description && snippet.description.length > 200 && (
              <Stack direction="row" justifyContent="center" sx={{ mt: 1 }}>
                <IconButton size="small"
                  onClick={() => setDescExpanded((v) => !v)}
                  aria-label={descExpanded ? 'Collapse description' : 'Expand description'}
                  sx={{ color: 'var(--c-text-dim)' }}>
                  {descExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </IconButton>
              </Stack>
            )}
          </Box>
        </Box>

        <Box sx={{ flex: { lg: '0 0 30%' }, minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: 'var(--c-text-faint)', letterSpacing: '0.18em', display: 'block', mb: 1 }}>
            {'// related'}
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(auto-fill, minmax(280px, 1fr))', lg: '1fr' },
            gap: 2,
          }}>
            {(relatedData?.items || []).map((it, i) => {
              const vid = it?.id?.videoId;
              if (!vid || vid === safeId || !it?.snippet) return null;
              const thumb = it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url || '';
              return (
                <Link key={vid || i} to={`/video/${vid}`} className="card-link">
                  <Stack direction={{ xs: 'column', lg: 'row' }} gap={1} sx={{ p: { lg: 0.75 } }}>
                    <Box sx={{
                      position: 'relative',
                      width: { xs: '100%', lg: 140 },
                      flex: { lg: '0 0 140px' },
                      bgcolor: '#111',
                    }}>
                      <Box component="img" src={thumb} alt="" loading="lazy" decoding="async"
                        sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, p: { xs: 1, lg: 0 } }}>
                      <Typography sx={{
                        color: 'var(--c-text)', fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {it.snippet.title}
                      </Typography>
                      <Typography sx={{ color: 'var(--c-text-dim)', fontSize: 11, mt: 0.5 }}>
                        {it.snippet.channelTitle}
                      </Typography>
                    </Box>
                  </Stack>
                </Link>
              );
            })}
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        onClose={() => setSnack({ open: false, msg: '' })}
        autoHideDuration={2000}
        message={snack.msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
