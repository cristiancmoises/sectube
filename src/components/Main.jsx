import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import Category from './Category.jsx';
import Videos from './Videos.jsx';
import InfiniteSentinel from './InfiniteSentinel.jsx';
import { Loader, ErrorPanel, FeedStatus } from './Loader.jsx';
import { usePagedVideos } from '../hooks/usePagedVideos.js';
import { DEFAULT_CATEGORY, getStoredRegion } from '../services/region.js';
import { buildFeedUrl } from '../constants/index.jsx';

export default function Main() {
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [region, setRegion] = useState(getStoredRegion());

  // Refresh when the region picker fires its event.
  useEffect(() => {
    const handler = (e) => { if (e.detail?.code) setRegion(e.detail.code); };
    window.addEventListener('sectube:region-change', handler);
    return () => window.removeEventListener('sectube:region-change', handler);
  }, []);

  // buildFeedUrl reads the region from storage; `region` in the deps makes the
  // URL recompute (and the pager reset) whenever the picker changes it.
  const baseUrl = useMemo(
    () => buildFeedUrl(selectedCategory, region),
    [selectedCategory, region]
  );

  const { items, loading, error, exhausted, loadMore } = usePagedVideos(baseUrl);
  const initialLoading = loading && items.length === 0;

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
    </>
  );
}
