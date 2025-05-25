import React, { useState } from 'react';
import {
  Box,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Slider,
} from '@mui/material';

const PropertyCalculator: React.FC = () => {
  const [propertyValue, setPropertyValue] = useState<number>(300000);
  const [downPayment, setDownPayment] = useState<number>(20);
  const [interestRate, setInterestRate] = useState<number>(3.5);
  const [loanTerm, setLoanTerm] = useState<number>(30);

  const calculateMonthlyPayment = () => {
    const principal = propertyValue * (1 - downPayment / 100);
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = loanTerm * 12;
    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    return monthlyPayment.toFixed(2);
  };

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Property Value"
            type="number"
            value={propertyValue}
            onChange={(e) => setPropertyValue(Number(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Down Payment (%)</InputLabel>
            <Select
              value={downPayment}
              onChange={(e) => setDownPayment(Number(e.target.value))}
            >
              <MenuItem value={5}>5%</MenuItem>
              <MenuItem value={10}>10%</MenuItem>
              <MenuItem value={15}>15%</MenuItem>
              <MenuItem value={20}>20%</MenuItem>
              <MenuItem value={25}>25%</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Interest Rate (%)</Typography>
          <Slider
            value={interestRate}
            onChange={(_, value) => setInterestRate(value as number)}
            min={2}
            max={8}
            step={0.1}
            marks
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Loan Term (years)</InputLabel>
            <Select
              value={loanTerm}
              onChange={(e) => setLoanTerm(Number(e.target.value))}
            >
              <MenuItem value={15}>15 years</MenuItem>
              <MenuItem value={20}>20 years</MenuItem>
              <MenuItem value={30}>30 years</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="h6" align="center">
            Monthly Payment: ${calculateMonthlyPayment()}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PropertyCalculator; 