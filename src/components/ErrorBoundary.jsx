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
        bgcolor: 'var(--c-bg)', color: 'var(--c-error)', p: 4, gap: 2, fontFamily: 'var(--mono)',
      }}>
        <Typography variant="overline" sx={{ color: 'var(--c-error)', letterSpacing: '0.2em' }}>
          {'>'} FATAL
        </Typography>
        <Typography variant="h5" sx={{ color: 'var(--c-error)' }}>Something broke.</Typography>
        <Typography variant="body2" sx={{ color: 'var(--c-text-dim)', maxWidth: 480, textAlign: 'center' }}>
          The app hit an unexpected error. Try reloading the page or click below to recover.
        </Typography>
        <Button variant="outlined" onClick={this.reset} sx={{
          borderColor: 'var(--c-error)', color: 'var(--c-error)',
          '&:hover': { borderColor: 'var(--c-error)', background: 'var(--c-primary-faint)' },
        }}>
          Try again
        </Button>
      </Box>
    );
  }
}
