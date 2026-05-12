import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './Navbar.jsx';
import Main from './Main.jsx';
import Channel from './Channel.jsx';
import VideoDetail from './VideoDetail.jsx';
import Search from './Search.jsx';
import Footer from './Footer.jsx';

export default function App() {
  return (
    <Box className="scanlines" sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box component="main" sx={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/channel/:id" element={<Channel />} />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/search/:id" element={<Search />} />
          <Route path="*" element={<Main />} />
        </Routes>
      </Box>
      <Footer />
    </Box>
  );
}
