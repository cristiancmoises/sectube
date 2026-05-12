import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import Category from './Category.jsx';
import Videos from './Videos.jsx';
import { Loader, ErrorPanel } from './Loader.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { buildSearchUrl, DEFAULT_CATEGORY, getStoredRegion } from '../services/region.js';
import { queryFor } from '../constants/index.jsx';

export default function Main() {
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [region, setRegion] = useState(getStoredRegion());

  // Refresh when the region picker fires its event.
  useEffect(() => {
    const handler = (e) => { if (e.detail?.code) setRegion(e.detail.code); };
    window.addEventListener('sectube:region-change', handler);
    return () => window.removeEventListener('sectube:region-change', handler);
  }, []);

  // Recompute URL whenever category OR region changes. The region read is
  // implicit (buildSearchUrl reads from storage); we include `region` in the
  // dep key so React re-renders and useFetch re-fires.
  const url = buildSearchUrl(queryFor(selectedCategory)) + `&_r=${region}`;
  const { data, error, loading, refetch } = useFetch(url);

  return (
    <>
      <Category selected={selectedCategory} onSelect={setSelectedCategory} />
      <Box className="page" sx={{ pt: 3 }}>
        <Stack direction="row" gap={1} alignItems="baseline" sx={{ mb: 2.5, flexWrap: 'wrap' }}>
          <Typography variant="overline" sx={{ color: 'var(--c-text-faint)', letterSpacing: '0.18em' }}>
            {'// feed'}
          </Typography>
          <Typography variant="h4" sx={{ color: 'var(--c-primary)' }}>
            {selectedCategory}
          </Typography>
          <span className="mono-chip" style={{
            border: '1px solid var(--c-border)',
            padding: '2px 8px',
            borderRadius: 3,
            alignSelf: 'center',
            marginLeft: 4,
          }}>
            {region}
          </span>
        </Stack>

        {loading && <Loader count={12} />}
        {error && <ErrorPanel error={error} onRetry={refetch} />}
        {!loading && !error && <Videos videos={data?.items || []} />}
      </Box>
    </>
  );
}
