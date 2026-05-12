import { useState } from 'react';
import { Menu, MenuItem, Tooltip, IconButton, Typography, Stack } from '@mui/material';
import { Public, Check } from '@mui/icons-material';
import { COUNTRIES, getStoredRegion, setStoredRegion } from '../services/region.js';

export default function RegionPicker() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [current, setCurrent] = useState(getStoredRegion());

  const open = (e) => setAnchorEl(e.currentTarget);
  const close = () => setAnchorEl(null);

  const pick = (code) => {
    setStoredRegion(code);
    setCurrent(code);
    close();
    // Force a refetch of whatever's on screen — simplest correct way is
    // to dispatch a custom event the feed listens for. Components subscribe
    // to 'sectube:region-change' to invalidate their cached data.
    window.dispatchEvent(new CustomEvent('sectube:region-change', { detail: { code } }));
  };

  return (
    <>
      <Tooltip title="Region" enterDelay={400}>
        <IconButton
          size="small"
          onClick={open}
          aria-label="Change region"
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorEl)}
        >
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Public fontSize="small" />
            <Typography sx={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--c-primary)' }}>
              {current}
            </Typography>
          </Stack>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'var(--c-bg-raised)',
              border: '1px solid var(--c-border)',
              minWidth: 200,
              mt: 1,
              maxHeight: 400,
            },
          },
        }}
      >
        {COUNTRIES.map((c) => (
          <MenuItem
            key={c.code}
            onClick={() => pick(c.code)}
            selected={c.code === current}
            sx={{ fontFamily: 'var(--mono)', py: 1, gap: 1.5 }}
          >
            <Typography sx={{ color: 'var(--c-primary)', fontWeight: 600, fontSize: 12, minWidth: 28, fontFamily: 'var(--mono)' }}>
              {c.code}
            </Typography>
            <Typography sx={{ color: 'var(--c-text)', fontSize: 13, flex: 1 }}>
              {c.label}
            </Typography>
            {c.code === current && <Check fontSize="small" sx={{ color: 'var(--c-primary)' }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
