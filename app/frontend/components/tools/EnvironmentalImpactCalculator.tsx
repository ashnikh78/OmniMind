import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Slider,
  Alert,
  Stack,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Emissions {
  energyEmissions: number;
  waterEmissions: number;
  wasteEmissions: number;
  transportEmissions: number;
  total: number;
}

const EnvironmentalImpactCalculator: React.FC = () => {
  const [energyUsage, setEnergyUsage] = useState<number>(0);
  const [waterUsage, setWaterUsage] = useState<number>(0);
  const [wasteProduction, setWasteProduction] = useState<number>(0);
  const [transportationDistance, setTransportationDistance] = useState<number>(0);
  const [showResults, setShowResults] = useState(false);

  const calculateCarbonFootprint = (): Emissions => {
    // Simplified carbon footprint calculation
    const energyEmissions = energyUsage * 0.5; // kg CO2 per kWh
    const waterEmissions = waterUsage * 0.3; // kg CO2 per cubic meter
    const wasteEmissions = wasteProduction * 2.5; // kg CO2 per kg
    const transportEmissions = transportationDistance * 0.2; // kg CO2 per km

    return {
      energyEmissions,
      waterEmissions,
      wasteEmissions,
      transportEmissions,
      total: energyEmissions + waterEmissions + wasteEmissions + transportEmissions
    };
  };

  const getRecommendations = (emissions: Emissions): string[] => {
    const recommendations: string[] = [];

    if (emissions.energyEmissions > 1000) {
      recommendations.push('Consider switching to renewable energy sources');
    }
    if (emissions.waterEmissions > 500) {
      recommendations.push('Implement water conservation measures');
    }
    if (emissions.wasteEmissions > 800) {
      recommendations.push('Increase recycling and waste reduction efforts');
    }
    if (emissions.transportEmissions > 600) {
      recommendations.push('Optimize transportation routes and consider electric vehicles');
    }

    return recommendations;
  };

  const handleCalculate = () => {
    setShowResults(true);
  };

  const emissions = calculateCarbonFootprint();
  const recommendations = getRecommendations(emissions);

  const chartData = [
    {
      name: 'Energy',
      emissions: emissions.energyEmissions,
    },
    {
      name: 'Water',
      emissions: emissions.waterEmissions,
    },
    {
      name: 'Waste',
      emissions: emissions.wasteEmissions,
    },
    {
      name: 'Transport',
      emissions: emissions.transportEmissions,
    },
  ];

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>
            <Stack spacing={3}>
              <TextField
                label="Energy Usage (kWh)"
                type="number"
                value={energyUsage}
                onChange={(e) => setEnergyUsage(Number(e.target.value))}
                fullWidth
              />
              <TextField
                label="Water Usage (m³)"
                type="number"
                value={waterUsage}
                onChange={(e) => setWaterUsage(Number(e.target.value))}
                fullWidth
              />
              <TextField
                label="Waste Production (kg)"
                type="number"
                value={wasteProduction}
                onChange={(e) => setWasteProduction(Number(e.target.value))}
                fullWidth
              />
              <TextField
                label="Transportation Distance (km)"
                type="number"
                value={transportationDistance}
                onChange={(e) => setTransportationDistance(Number(e.target.value))}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleCalculate}
                fullWidth
              >
                Calculate Impact
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {showResults && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Environmental Impact Analysis
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Total Carbon Footprint: {emissions.total.toFixed(2)} kg CO2
              </Alert>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'CO2 Emissions (kg)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="emissions" fill="#8884d8" name="CO2 Emissions" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Recommendations:
              </Typography>
              <Stack spacing={1}>
                {recommendations.map((rec, index) => (
                  <Alert key={index} severity="success" sx={{ mb: 1 }}>
                    {rec}
                  </Alert>
                ))}
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default EnvironmentalImpactCalculator; 