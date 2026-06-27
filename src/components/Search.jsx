import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import Videos from './Videos.jsx';
import InfiniteSentinel from './InfiniteSentinel.jsx';
import { Loader, ErrorPanel, FeedStatus } from './Loader.jsx';
import { usePagedVideos } from '../hooks/usePagedVideos.js';
import { buildSearchUrl, getStoredRegion, languageFor, PAGE_SIZE } from '../services/region.js';

export default function Search() {
  const { id } = useParams();
  const query = useMemo(() => {
    try { return decodeURIComponent(id || ''); } catch { return id || ''; }
  }, [id]);

  // Re-search when the region picker changes the regional bias (mirrors Main).
  const [region, setRegion] = useState(getStoredRegion());
  useEffect(() => {
    const handler = (e) => { if (e.detail?.code) setRegion(e.detail.code); };
    window.addEventListener('sectube:region-change', handler);
    return () => window.removeEventListener('sectube:region-change', handler);
  }, []);

  // No type filter: search returns videos AND channels, both of which render.
  // buildSearchUrl reads the region from storage; `region` in the deps makes the
  // URL recompute (and the pager reset) when the picker changes it.
  const baseUrl = useMemo(
    () => (query
      ? buildSearchUrl(
          query,
          { maxResults: String(PAGE_SIZE), regionCode: region, relevanceLanguage: languageFor(region) },
          { regional: false }
        )
      : null),
    [query, region]
  );

  const { items, loading, error, exhausted, loadMore } = usePagedVideos(baseUrl);
  const initialLoading = loading && items.length === 0;

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

      {initialLoading && <Loader count={12} />}
      {error && items.length === 0 && <ErrorPanel error={error} onRetry={loadMore} />}
      {!initialLoading && (!error || items.length > 0) && (
        <>
          <Videos videos={items} />
          <FeedStatus
            loading={loading}
            error={error}
            exhausted={exhausted}
            count={items.length}
            onRetry={loadMore}
          />
          <InfiniteSentinel onLoadMore={loadMore} disabled={loading || exhausted || Boolean(error)} />
        </>
      )}
    </Box>
  );
}
