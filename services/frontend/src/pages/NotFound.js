import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Button, Stack, Fade } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { Error as ErrorIcon, ArrowBack as ArrowBackIcon, Home as HomeIcon } from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';

function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <>
      <Helmet>
        <title>404 - Page Not Found | OmniMind</title>
        <meta name="description" content="The page you are looking for could not be found." />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      
      <Fade in timeout={1000}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            p: 3,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          }}
          role="alert"
          aria-live="polite"
        >
          <ErrorIcon 
            sx={{ 
              fontSize: 120, 
              color: 'error.main', 
              mb: 2,
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.1)' },
                '100%': { transform: 'scale(1)' },
              },
            }} 
            aria-hidden="true"
          />
          
          <Typography 
            variant="h1" 
            component="h1" 
            gutterBottom
            sx={{
              fontSize: { xs: '4rem', md: '6rem' },
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #FF6B6B 30%, #4ECDC4 90%)',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </Typography>
          
          <Typography 
            variant="h4" 
            component="h2" 
            gutterBottom
            sx={{ mb: 3 }}
          >
            Page Not Found
          </Typography>
          
          <Typography 
            variant="body1" 
            color="text.secondary" 
            paragraph
            sx={{ maxWidth: '600px', mb: 4 }}
          >
            The page you are looking for might have been removed, had its name changed,
            or is temporarily unavailable.
          </Typography>

          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2}
            sx={{ mt: 2 }}
          >
            <Button
              variant="outlined"
              size="large"
              onClick={handleGoBack}
              startIcon={<ArrowBackIcon />}
              sx={{ 
                minWidth: '200px',
                borderRadius: '25px',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
                transition: 'all 0.3s ease',
              }}
            >
              Go Back
            </Button>
            
            <Button
              variant="contained"
              size="large"
              onClick={handleGoHome}
              startIcon={<HomeIcon />}
              sx={{ 
                minWidth: '200px',
                borderRadius: '25px',
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
                transition: 'all 0.3s ease',
              }}
            >
              Go to Homepage
            </Button>
          </Stack>
        </Box>
      </Fade>
    </>
  );
}

NotFound.propTypes = {
  // Add any props if needed in the future
};

export default NotFound; 