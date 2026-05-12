import { Box, Stack, Typography } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { compactCount } from '../utils/format.js';

export default function ChannelCard({ video, marginTop }) {
  if (!video) return null;
  const snippet = video.snippet;
  if (!snippet) return null;
  const channelId = video.id?.channelId || snippet.channelId || video.id;
  const subs = video.statistics?.subscriberCount;
  const thumb = snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || '';

  return (
    <Box sx={{ width: { xs: '100%', sm: 340 }, mx: 'auto', mt: marginTop, p: 2 }}>
      <Link to={channelId ? `/channel/${channelId}` : '#'} className="card-link">
        <Stack alignItems="center" textAlign="center" spacing={1.5} sx={{ py: 3 }}>
          <Box
            component="img"
            src={thumb}
            alt=""
            sx={{
              borderRadius: '50%',
              width: 160,
              height: 160,
              border: '1px solid var(--c-border)',
              bgcolor: '#111',
              objectFit: 'cover',
              boxShadow: 'var(--glow-soft)',
            }}
          />
          <Stack direction="row" gap={0.5} alignItems="center">
            <Typography variant="h6" sx={{ color: 'var(--c-text)' }}>
              {snippet.title}
            </Typography>
            <CheckCircle sx={{ fontSize: 14, color: 'var(--c-text-faint)' }} />
          </Stack>
          {subs && (
            <span className="mono-chip">{compactCount(subs)} subscribers</span>
          )}
        </Stack>
      </Link>
    </Box>
  );
}
