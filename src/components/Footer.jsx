import { Box, Stack, Typography } from '@mui/material';

export default function Footer() {
  return (
    <Box component="footer" sx={{
      mt: 6,
      borderTop: '1px solid var(--c-border)',
      py: 2.5,
      px: { xs: 2, md: 3 },
    }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="center" justifyContent="space-between"
        sx={{ maxWidth: 1500, mx: 'auto' }}>
        <Typography variant="overline" sx={{ color: 'var(--c-text-faint)', letterSpacing: '0.16em' }}>
          SecTube · v3 · powered by YouTube Data API v3
        </Typography>
        <Typography variant="overline" sx={{ color: 'var(--c-text-faint)', letterSpacing: '0.16em' }}>
          no login · no tracking · no ads
        </Typography>
      </Stack>
    </Box>
  );
}
