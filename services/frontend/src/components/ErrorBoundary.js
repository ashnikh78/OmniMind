import React from 'react';
import { Box, Typography, Button } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    // You can also log the error to an error reporting service here
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="h4" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            We apologize for the inconvenience. Please try refreshing the page or contact support if the problem persists.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={this.handleReset}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ mt: 4, textAlign: 'left', maxWidth: '800px' }}>
              <Typography variant="subtitle2" color="error">
                {this.state.error?.toString()}
              </Typography>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  overflow: 'auto',
                }}
              >
                {this.state.errorInfo?.componentStack}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 