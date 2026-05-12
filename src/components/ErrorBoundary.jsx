import { Component } from 'react';
import { Box, Button, Typography } from '@mui/material';

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[SecTube] ErrorBoundary:', error, info); }
  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box sx={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        bgcolor: '#000', color: '#ff4081', p: 4, gap: 2, fontFamily: 'var(--mono)',
      }}>
        <Typography variant="overline" sx={{ color: '#ff4081', letterSpacing: '0.2em' }}>
          {'>'} FATAL
        </Typography>
        <Typography variant="h5" sx={{ color: '#ff4081' }}>Something broke.</Typography>
        <Typography variant="body2" sx={{ color: '#ff79b0', maxWidth: 480, textAlign: 'center' }}>
          The app hit an unexpected error. Try reloading the page or click below to recover.
        </Typography>
        <Button variant="outlined" onClick={this.reset} sx={{
          borderColor: '#ff4081', color: '#ff4081',
          '&:hover': { borderColor: '#ff79b0', background: 'rgba(255,64,129,0.08)' },
        }}>
          Try again
        </Button>
      </Box>
    );
  }
}
