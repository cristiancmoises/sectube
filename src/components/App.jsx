import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './Navbar.jsx';
import Main from './Main.jsx';
import Footer from './Footer.jsx';
import { Loader } from './Loader.jsx';

// Code-split the heavier routes. VideoDetail pulls in the custom Player and
// DOMPurify; Channel pulls in its tab machinery. Keeping them out of the
// landing bundle shrinks the critical path for the home feed.
//
// lazyWithReload: after a redeploy, an already-open tab still references the
// previous build's chunk hashes, which no longer exist on the server — the
// dynamic import then 404s and would crash the route. We recover by reloading
// the page ONCE (which pulls the fresh index.html + chunks). The session flag
// prevents a reload loop if the failure is genuine rather than a stale chunk.
const RELOAD_FLAG = 'sectube:chunk-reloaded';
function lazyWithReload(factory) {
  return lazy(() =>
    factory()
      .then((m) => { try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ } return m; })
      .catch((err) => {
        let reloadedAlready = true;
        try {
          reloadedAlready = sessionStorage.getItem(RELOAD_FLAG) === '1';
          if (!reloadedAlready) sessionStorage.setItem(RELOAD_FLAG, '1');
        } catch { /* private mode: fall through and surface the error */ }
        if (!reloadedAlready) {
          window.location.reload();
          return new Promise(() => {}); // hang until the reload takes over
        }
        throw err; // already reloaded once — this is a real error, let it surface
      })
  );
}

const Channel = lazyWithReload(() => import('./Channel.jsx'));
const VideoDetail = lazyWithReload(() => import('./VideoDetail.jsx'));
const Search = lazyWithReload(() => import('./Search.jsx'));

export default function App() {
  return (
    <Box className="scanlines" sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box component="main" sx={{ flex: 1 }}>
        <Suspense fallback={<Box className="page" sx={{ pt: 3 }}><Loader count={12} /></Box>}>
          <Routes>
            <Route path="/" element={<Main />} />
            <Route path="/channel/:id" element={<Channel />} />
            <Route path="/video/:id" element={<VideoDetail />} />
            <Route path="/search/:id" element={<Search />} />
            <Route path="*" element={<Main />} />
          </Routes>
        </Suspense>
      </Box>
      <Footer />
    </Box>
  );
}
