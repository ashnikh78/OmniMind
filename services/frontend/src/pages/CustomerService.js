import React, { useContext } from 'react';
import { Box, Typography } from '@mui/material';
import CustomerAnalysis from '../components/CustomerAnalysis';
import { AuthContext } from '../contexts/AuthContext';

const CustomerService = () => {
  const { user, token } = useContext(AuthContext);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Customer Service Analysis
      </Typography>

      {user && token ? (
        <CustomerAnalysis userId={user?.id} token={token} />
      ) : (
        <Typography color="error">
          Please log in to access customer service analysis.
        </Typography>
      )}
    </Box>
  );
};

export default CustomerService;
