import { useState } from 'react';
import { Menu, MenuItem, Tooltip, IconButton, Box, Typography } from '@mui/material';
import { Palette, Check } from '@mui/icons-material';
import { themes, getStoredThemeId, setStoredTheme } from '../theme.js';

export default function ThemePicker() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [current, setCurrent] = useState(getStoredThemeId());

  const open = (e) => setAnchorEl(e.currentTarget);
  const close = () => setAnchorEl(null);

  const pick = (id) => {
    setStoredTheme(id);
    setCurrent(id);
    // notify the ThemeProvider wrapper in index.jsx
    window.dispatchEvent(new CustomEvent('sectube:theme-change', { detail: { id } }));
    close();
  };

  return (
    <>
      <Tooltip title="Theme" enterDelay={400}>
        <IconButton
          size="small"
          onClick={open}
          aria-label="Change theme"
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorEl)}
        >
          <Palette fontSize="small" />
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
              minWidth: 220,
              mt: 1,
            },
          },
        }}
      >
        {Object.values(themes).map((t) => (
          <MenuItem
            key={t.id}
            onClick={() => pick(t.id)}
            selected={t.id === current}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, fontFamily: 'var(--mono)' }}
          >
            <Box
              sx={{
                width: 14, height: 14, borderRadius: '50%',
                background: t.primary,
                border: `1px solid ${t.primary}`,
                boxShadow: `0 0 6px ${t.primary}55`,
                flex: '0 0 auto',
              }}
              aria-hidden="true"
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: 'var(--c-text)', fontSize: 13, fontFamily: 'var(--mono)' }}>
                {t.label}
              </Typography>
              <Typography sx={{ color: 'var(--c-text-faint)', fontSize: 10 }}>
                {t.description}
              </Typography>
            </Box>
            {t.id === current && <Check fontSize="small" sx={{ color: 'var(--c-primary)' }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
