import { Box, Stack, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import Videos from './Videos.jsx';
import { Loader, ErrorPanel } from './Loader.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { buildSearchUrl } from '../services/region.js';

export default function Search() {
  const { id } = useParams();
  const query = (() => {
    try { return decodeURIComponent(id || ''); } catch { return id || ''; }
  })();
  const { data, error, loading, refetch } = useFetch(query ? buildSearchUrl(query) : null);

  return (
    <Box className="page" sx={{ pt: 3 }}>
      <Stack direction="row" gap={1} alignItems="baseline" sx={{ mb: 2.5, flexWrap: 'wrap' }}>
        <Typography variant="overline" sx={{ color: 'var(--c-text-faint)', letterSpacing: '0.18em' }}>
          {'// search'}
        </Typography>
        <Typography variant="h4" sx={{
          color: 'var(--c-primary)', wordBreak: 'break-word',
          fontFamily: 'var(--mono)',
        }}>
          {query}
        </Typography>
      </Stack>
      {loading && <Loader count={12} />}
      {error && <ErrorPanel error={error} onRetry={refetch} />}
      {!loading && !error && <Videos videos={data?.items || []} />}
    </Box>
  );
}
