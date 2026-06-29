import { Box, Stack, IconButton, Tooltip } from '@mui/material';
import { GitHub } from '@mui/icons-material';
import Brand from './Brand.jsx';
import SearchBar from './SearchBar.jsx';
import RegionPicker from './RegionPicker.jsx';
import ThemePicker from './ThemePicker.jsx';

export default function Navbar() {
  return (
    <Box component="header" sx={{
      position: 'sticky', top: 0, zIndex: 1000,
      backdropFilter: 'blur(8px)',
      background: 'rgba(0, 0, 0, 0.78)',
      borderBottom: '1px solid var(--c-border)',
    }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: { xs: 2, md: 3 }, py: 1.5, gap: { xs: 1, md: 1.5 }, maxWidth: 1500, mx: 'auto' }}>
        <Brand />
        {/* Inline search on desktop only; on mobile it moves to its own row
            below (it's unusable squeezed between the brand and the icons). */}
        <Box sx={{ display: { xs: 'none', md: 'contents' } }}>
          <SearchBar />
        </Box>
        <Stack direction="row" gap={0.5} alignItems="center" sx={{ flex: '0 0 auto' }}>
          <RegionPicker />
          <ThemePicker />
          <Tooltip title="Source on GitHub" enterDelay={500}>
            <IconButton
              component="a"
              href="https://github.com/cristiancmoises/sectube"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              size="small"
            >
              <GitHub fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Full-width mobile search row */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2, pb: 1.5 }}>
        <SearchBar />
      </Box>
    </Box>
  );
}
