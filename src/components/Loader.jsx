import { Box, Button, Stack, Typography } from '@mui/material';

/** Skeleton-card grid that matches the real VideoCard layout. */
export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="grid" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i}>
          <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9' }} />
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flex: '0 0 auto' }} />
            <Box sx={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '85%', height: 14 }} />
              <div className="skeleton" style={{ width: '50%', height: 12, marginTop: 6 }} />
            </Box>
          </Box>
        </Box>
      ))}
    </div>
  );
}

export function Loader({ count = 8 }) { return <SkeletonGrid count={count} />; }

export function ErrorPanel({ error, onRetry }) {
  const msg = error?.message || 'Something went wrong.';
  const isKeyIssue = error?.status === 401 || error?.status === 403;
  return (
    <Box sx={{ py: 6, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack spacing={2} alignItems="center" maxWidth={520}>
        <Typography variant="overline" sx={{ color: '#ff4081', letterSpacing: '0.18em' }}>
          {'>'} ERROR
        </Typography>
        <Typography variant="h6" sx={{ color: '#ff4081', textAlign: 'center', fontFamily: 'var(--mono)' }}>
          {msg}
        </Typography>
        {isKeyIssue && (
          <Typography variant="body2" sx={{ color: 'var(--c-text-dim)', textAlign: 'center', maxWidth: 420 }}>
            The site admin needs to set <code>RAPIDAPI_KEY</code> in <code>.env</code> and restart the container.
          </Typography>
        )}
        {onRetry && (
          <Button variant="outlined" color="inherit" onClick={onRetry}
            sx={{ borderColor: '#ff4081', color: '#ff4081',
                  '&:hover': { borderColor: '#ff79b0', background: 'rgba(255,64,129,0.08)' } }}>
            Retry
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export function EmptyState({ message = 'No videos found.' }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="overline" sx={{ color: 'var(--c-text-faint)', letterSpacing: '0.2em' }}>
        {'// 0 results'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--c-text-dim)', mt: 1 }}>{message}</Typography>
    </Box>
  );
}

export default Loader;
