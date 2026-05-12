import { createTheme } from '@mui/material/styles';

/**
 * Theme catalog. Each entry is a complete palette.
 * To add a new theme: add a key here and a matching `[data-theme="key"]`
 * block in src/index.css.
 */
export const themes = {
  securityops: {
    id: 'securityops',
    label: 'SecurityOps',
    description: 'Cyan on pure black. Default.',
    primary:   '#00e5ff',
    primaryHi: '#18ffff',
    primaryLo: '#00bcd4',
    secondary: '#4dd0e1',
    error:     '#ff4081',
  },
  crimson: {
    id: 'crimson',
    label: 'Crimson',
    description: 'Red on black. Combat aesthetic.',
    primary:   '#ff3b3b',
    primaryHi: '#ff6e6e',
    primaryLo: '#c41818',
    secondary: '#ff9b9b',
    error:     '#ffaf00',
  },
  synthwave: {
    id: 'synthwave',
    label: 'Synthwave',
    description: 'Magenta/violet retro.',
    primary:   '#ff6ec7',
    primaryHi: '#ffa8de',
    primaryLo: '#c91d8e',
    secondary: '#a86bff',
    error:     '#ffd166',
  },
  matrix: {
    id: 'matrix',
    label: 'Matrix',
    description: 'Phosphor green terminal.',
    primary:   '#00ff66',
    primaryHi: '#5cff9e',
    primaryLo: '#00b347',
    secondary: '#7fffb8',
    error:     '#ff4081',
  },
  mono: {
    id: 'mono',
    label: 'Mono',
    description: 'White on black. No color.',
    primary:   '#ffffff',
    primaryHi: '#ffffff',
    primaryLo: '#bbbbbb',
    secondary: '#999999',
    error:     '#ff4081',
  },
};

export const DEFAULT_THEME = 'securityops';
export const THEME_KEY = 'sectube.theme';

/** Read current theme id from localStorage; fall back to default. */
export function getStoredThemeId() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v && themes[v]) return v;
  } catch { /* private mode */ }
  return DEFAULT_THEME;
}

/** Persist theme id and update the document attribute that drives CSS vars. */
export function setStoredTheme(id) {
  if (!themes[id]) return;
  try { localStorage.setItem(THEME_KEY, id); } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', id);
  }
}

/** Build an MUI theme from a palette spec. */
export function buildMuiTheme(palette) {
  return createTheme({
    palette: {
      mode: 'dark',
      primary:    { main: palette.primary, light: palette.primaryHi, dark: palette.primaryLo, contrastText: '#000' },
      secondary:  { main: palette.secondary, contrastText: '#000' },
      background: { default: '#000', paper: '#0a0a0a' },
      text:       { primary: palette.primary, secondary: palette.secondary, disabled: 'rgba(255,255,255,0.30)' },
      error:      { main: palette.error, contrastText: '#000' },
      divider:    'rgba(255, 255, 255, 0.12)',
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.01em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      button: { fontWeight: 600, letterSpacing: '0.04em', textTransform: 'none' },
      caption: { fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontWeight: 500 },
      overline: { fontFamily: '"JetBrains Mono", ui-monospace, monospace', letterSpacing: '0.12em' },
      allVariants: { color: palette.primary },
    },
    components: {
      MuiButton: {
        defaultProps: { color: 'primary', disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 4 },
          outlined: { borderColor: palette.primary, color: palette.primary },
          contained: { background: palette.primary, color: '#000' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, letterSpacing: '0.05em' },
          filled: { background: palette.primary, color: '#000', fontWeight: 600 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { height: 2 }, bar: { background: palette.primary } },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundColor: '#000', backgroundImage: 'none' } },
      },
      MuiCard: {
        styleOverrides: { root: { backgroundColor: '#000', backgroundImage: 'none', boxShadow: 'none' } },
      },
      MuiIconButton: {
        styleOverrides: { root: { color: palette.primary } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { background: '#0a0a0a', color: palette.primary, border: `1px solid ${palette.primary}33`, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11 },
        },
      },
    },
  });
}

/** Convenience: get fully-built theme for a given id. */
export function getThemeFor(id) {
  const p = themes[id] || themes[DEFAULT_THEME];
  return buildMuiTheme(p);
}
