import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Slider,
  FormControlLabel,
  Checkbox,
  Button,
  Alert,
  Paper,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

interface RiskData {
  dataSecurity: number;
  networkSecurity: number;
  physicalSecurity: number;
  compliance: number;
  incidentResponse: number;
  accessControl: number;
}

interface SecurityMeasures {
  dataEncryption: boolean;
  backupSystem: boolean;
  securityTraining: boolean;
  monitoringSystem: boolean;
}

const RiskAssessmentTool: React.FC = () => {
  const [riskData, setRiskData] = useState<RiskData>({
    dataSecurity: 50,
    networkSecurity: 50,
    physicalSecurity: 50,
    compliance: 50,
    incidentResponse: 50,
    accessControl: 50,
  });

  const [securityMeasures, setSecurityMeasures] = useState<SecurityMeasures>({
    dataEncryption: false,
    backupSystem: false,
    securityTraining: false,
    monitoringSystem: false,
  });

  const [riskHistory, setRiskHistory] = useState<{ date: string; score: number }[]>([]);

  const calculateRiskScore = () => {
    const baseScore =
      (riskData.dataSecurity +
        riskData.networkSecurity +
        riskData.physicalSecurity +
        riskData.compliance +
        riskData.incidentResponse +
        riskData.accessControl) /
      6;

    let mitigationScore = 0;
    if (securityMeasures.dataEncryption) mitigationScore += 10;
    if (securityMeasures.backupSystem) mitigationScore += 10;
    if (securityMeasures.securityTraining) mitigationScore += 10;
    if (securityMeasures.monitoringSystem) mitigationScore += 10;

    return Math.max(0, Math.min(100, baseScore - mitigationScore));
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'Critical', color: 'error' };
    if (score >= 60) return { level: 'High', color: 'warning' };
    if (score >= 40) return { level: 'Medium', color: 'info' };
    return { level: 'Low', color: 'success' };
  };

  const handleSaveAssessment = () => {
    const score = calculateRiskScore();
    const newHistory = [
      ...riskHistory,
      { date: new Date().toISOString().split('T')[0], score },
    ];
    setRiskHistory(newHistory);
  };

  const exportRiskReport = () => {
    const report = {
      date: new Date().toISOString(),
      riskScore: calculateRiskScore(),
      riskData,
      securityMeasures,
      recommendations: [
        'Implement regular security audits',
        'Update security policies',
        'Conduct employee training',
        'Review access controls',
      ],
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-assessment-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const riskScore = calculateRiskScore();
  const riskLevel = getRiskLevel(riskScore);

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Data Security Risk</Typography>
          <Slider
            value={riskData.dataSecurity}
            onChange={(_, value) =>
              setRiskData((prev) => ({ ...prev, dataSecurity: value as number }))
            }
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Network Security Risk</Typography>
          <Slider
            value={riskData.networkSecurity}
            onChange={(_, value) =>
              setRiskData((prev) => ({ ...prev, networkSecurity: value as number }))
            }
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Physical Security Risk</Typography>
          <Slider
            value={riskData.physicalSecurity}
            onChange={(_, value) =>
              setRiskData((prev) => ({ ...prev, physicalSecurity: value as number }))
            }
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Compliance Risk</Typography>
          <Slider
            value={riskData.compliance}
            onChange={(_, value) =>
              setRiskData((prev) => ({ ...prev, compliance: value as number }))
            }
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Incident Response Risk</Typography>
          <Slider
            value={riskData.incidentResponse}
            onChange={(_, value) =>
              setRiskData((prev) => ({ ...prev, incidentResponse: value as number }))
            }
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography gutterBottom>Access Control Risk</Typography>
          <Slider
            value={riskData.accessControl}
            onChange={(_, value) =>
              setRiskData((prev) => ({ ...prev, accessControl: value as number }))
            }
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Security Measures
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={securityMeasures.dataEncryption}
                    onChange={(e) =>
                      setSecurityMeasures((prev) => ({
                        ...prev,
                        dataEncryption: e.target.checked,
                      }))
                    }
                  />
                }
                label="Data Encryption"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={securityMeasures.backupSystem}
                    onChange={(e) =>
                      setSecurityMeasures((prev) => ({
                        ...prev,
                        backupSystem: e.target.checked,
                      }))
                    }
                  />
                }
                label="Backup System"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={securityMeasures.securityTraining}
                    onChange={(e) =>
                      setSecurityMeasures((prev) => ({
                        ...prev,
                        securityTraining: e.target.checked,
                      }))
                    }
                  />
                }
                label="Security Training"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={securityMeasures.monitoringSystem}
                    onChange={(e) =>
                      setSecurityMeasures((prev) => ({
                        ...prev,
                        monitoringSystem: e.target.checked,
                      }))
                    }
                  />
                }
                label="Monitoring System"
              />
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveAssessment}
            >
              Save Assessment
            </Button>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={exportRiskReport}
            >
              Export Report
            </Button>
          </Box>
          <Alert severity={riskLevel.color as any}>
            Risk Score: {riskScore.toFixed(1)} - {riskLevel.level}
          </Alert>
        </Grid>

        {riskHistory.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Risk History
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={riskHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#8884d8"
                    name="Risk Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default RiskAssessmentTool; 