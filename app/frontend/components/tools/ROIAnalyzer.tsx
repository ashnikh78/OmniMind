import React, { useState } from 'react';
import {
  Box,
  Grid,
  TextField,
  Typography,
  Slider,
} from '@mui/material';

const ROIAnalyzer: React.FC = () => {
  const [initialInvestment, setInitialInvestment] = useState<number>(100000);
  const [annualReturn, setAnnualReturn] = useState<number>(8);
  const [years, setYears] = useState<number>(5);

  const calculateROI = () => {
    const futureValue = initialInvestment * Math.pow(1 + annualReturn / 100, years);
    const roi = ((futureValue - initialInvestment) / initialInvestment) * 100;
    return roi.toFixed(2);
  };

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Initial Investment"
            type="number"
            value={initialInvestment}
            onChange={(e) => setInitialInvestment(Number(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography gutterBottom>Annual Return (%)</Typography>
          <Slider
            value={annualReturn}
            onChange={(_, value) => setAnnualReturn(value as number)}
            min={1}
            max={20}
            step={0.5}
            marks
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography gutterBottom>Investment Period (years)</Typography>
          <Slider
            value={years}
            onChange={(_, value) => setYears(value as number)}
            min={1}
            max={30}
            step={1}
            marks
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="h6" align="center">
            ROI: {calculateROI()}%
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ROIAnalyzer; 