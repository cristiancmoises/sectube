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
  return (
    <Box sx={{ py: 6, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack spacing={2} alignItems="center" maxWidth={560}>
        <Typography variant="overline" sx={{ color: 'var(--c-error)', letterSpacing: '0.18em' }}>
          {'>'} ERROR
        </Typography>
        <Typography variant="h6" sx={{ color: 'var(--c-error)', textAlign: 'center', fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
          {msg}
        </Typography>
        {onRetry && (
          <Button variant="outlined" color="inherit" onClick={onRetry}
            sx={{ borderColor: 'var(--c-error)', color: 'var(--c-error)',
                  '&:hover': { borderColor: 'var(--c-error)', background: 'var(--c-primary-faint)' } }}>
            Retry
          </Button>
        )}
      </Stack>
    </Box>
  );
}

/**
 * Footer shown under an infinite-scroll grid: a spinner while the next page
 * loads, a one-time error with retry, or an end-of-feed marker.
 */
export function FeedStatus({ loading, error, exhausted, count, onRetry }) {
  if (error) {
    return (
      <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
        <Button variant="outlined" color="inherit" onClick={onRetry}
          sx={{ borderColor: '#ff4081', color: '#ff4081' }}>
          Failed to load more — retry
        </Button>
      </Stack>
    );
  }
  if (loading) {
    return (
      <Stack direction="row" gap={1.5} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
        <span className="spinner" aria-hidden="true" />
        <Typography sx={{ color: 'var(--c-text-dim)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          loading…
        </Typography>
      </Stack>
    );
  }
  if (exhausted && count > 0) {
    return (
      <Typography align="center" sx={{ color: 'var(--c-text-faint)', fontFamily: 'var(--mono)', fontSize: 11, py: 4 }}>
        — END · {count} videos —
      </Typography>
    );
  }
  return null;
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
