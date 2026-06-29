import { Avatar, Box, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { CheckCircle } from '@mui/icons-material';
import { timeFromNow, compactCount, formatDuration } from '../utils/format.js';

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}

export default function VideoCard({ video }) {
  const videoId = video?.id?.videoId;
  const snippet = video?.snippet;
  if (!videoId || !snippet) return null;

  const thumb = snippet.thumbnails?.high?.url
             || snippet.thumbnails?.medium?.url
             || snippet.thumbnails?.default?.url
             || '';
  const title = snippet.title || 'Untitled';
  const duration = formatDuration(video?.contentDetails?.duration);
  const views = video?.statistics?.viewCount;

  return (
    <article>
      <Link to={`/video/${videoId}`} className="card-link" aria-label={title}>
        <Box sx={{ position: 'relative', bgcolor: '#111' }}>
          <Box
            component="img"
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
          />
          {duration && <span className="duration-badge">{duration}</span>}
        </Box>

        <Stack direction="row" gap={1.25} sx={{ p: 1.25 }}>
          {snippet.channelId ? (
            <Avatar
              src={snippet.thumbnails?.default?.url}
              alt=""
              sx={{ width: 32, height: 32, flex: '0 0 auto' }}
            />
          ) : (
            <Box sx={{ width: 32, flex: '0 0 auto' }} />
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              className="card-title"
              sx={{
                color: 'var(--c-text-strong)',
                fontWeight: 600,
                fontSize: 14,
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </Typography>
            <Stack direction="row" gap={0.75} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography
                sx={{ color: 'var(--c-text-dim)', fontSize: 12, fontWeight: 500 }}
              >
                {truncate(snippet.channelTitle, 32)}
              </Typography>
              <CheckCircle sx={{ fontSize: 11, color: 'var(--c-text-faint)' }} />
            </Stack>
            <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 0.5 }}>
              {views && <span className="mono-chip">{compactCount(views)} views</span>}
              {views && snippet.publishedAt && (
                <span className="mono-chip" aria-hidden="true">·</span>
              )}
              {snippet.publishedAt && (
                <span className="mono-chip">{timeFromNow(snippet.publishedAt)}</span>
              )}
            </Stack>
          </Box>
        </Stack>
      </Link>
    </article>
  );
}
