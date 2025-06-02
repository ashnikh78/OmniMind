import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import { customerServiceAPI, wsManager } from '../services/api'; // Updated path
import { toast } from 'react-toastify';

const CustomerAnalysis = ({ userId, token }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Connect WebSocket
    if (userId && token) {
      wsManager.connect(userId, token);
    }

    // Subscribe to analysis results
    const unsubscribe = customerServiceAPI.subscribe((data) => {
      setResult(data);
      setError(null);
      toast.success('Analysis result received via WebSocket');
    });

    return () => {
      unsubscribe();
      wsManager.disconnect();
    };
  }, [userId, token]);

  const handleAnalyze = async () => {
    try {
      const interactionData = { text, context: {} };
      const response = await customerServiceAPI.analyzeInteraction(interactionData);
      setResult(response);
      setError(null);
      toast.success('Analysis completed');
    } catch (err) {
      setError(err.message);
      setResult(null);
      toast.error(err.message);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <TextField
        fullWidth
        multiline
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter customer interaction text (e.g., 'Customer is upset about delayed delivery')"
        label="Interaction Text"
        variant="outlined"
        margin="normal"
      />
      <Button
        variant="contained"
        onClick={handleAnalyze}
        disabled={!text}
        sx={{ mt: 2 }}
      >
        Analyze
      </Button>
      {result && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6">Analysis Result</Typography>
          <pre style={{ background: '#f5f5f5', p: 2, borderRadius: 4 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </Box>
      )}
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default CustomerAnalysis;