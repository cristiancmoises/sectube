import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import App from './components/App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { getThemeFor, getStoredThemeId, THEME_KEY, setStoredTheme } from './theme.js';
import './index.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';

// Stateful theme wrapper. Listens for in-tab theme changes via a custom event
// (dispatched by the theme picker), and cross-tab via the 'storage' event.
function ThemedApp() {
  const [themeId, setThemeId] = useState(getStoredThemeId());

  // Apply the data-theme attr immediately so CSS vars match the MUI palette.
  useEffect(() => { setStoredTheme(themeId); }, [themeId]);

  useEffect(() => {
    const onLocal = (e) => { if (e.detail?.id) setThemeId(e.detail.id); };
    const onStorage = (e) => {
      if (e.key === THEME_KEY && e.newValue && e.newValue !== themeId) {
        setThemeId(e.newValue);
      }
    };
    window.addEventListener('sectube:theme-change', onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('sectube:theme-change', onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, [themeId]);

  const muiTheme = useMemo(() => getThemeFor(themeId), [themeId]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <ErrorBoundary>
      <ThemedApp />
    </ErrorBoundary>
  </StrictMode>
);
