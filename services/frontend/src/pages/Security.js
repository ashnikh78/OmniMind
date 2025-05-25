import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert,
  Box,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Lock as LockIcon,
  VpnKey as VpnKeyIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  Shield as ShieldIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { analyticsAPI } from '../services/api';

function SecurityMetric({ title, value, icon, color, loading }) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <IconButton size="small">
            {icon}
          </IconButton>
        }
      />
      <CardContent>
        <Typography variant="h4" component="div">
          {value}
        </Typography>
        {loading && (
          <LinearProgress
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Security() {
  const [securitySettings, setSecuritySettings] = React.useState({
    twoFactorAuth: true,
    passwordExpiry: true,
    sessionTimeout: 30,
    ipWhitelist: true,
    auditLogging: true,
  });

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    activeUsers: '0',
    failedLogins: '0',
    securityAlerts: '0',
    lastScan: 'Never',
  });
  const [error, setError] = useState(null);

  const handleSettingChange = (setting) => (event) => {
    setSecuritySettings({
      ...securitySettings,
      [setting]: event.target.checked,
    });
  };

  const handleTimeoutChange = (event) => {
    setSecuritySettings({
      ...securitySettings,
      sessionTimeout: event.target.value,
    });
  };

  useEffect(() => {
    const fetchSecurityMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await analyticsAPI.getMetrics();
        const data = response.data || {};
        
        setMetrics({
          activeUsers: data.active_users?.toString() || '0',
          failedLogins: data.performance?.errors?.total?.toString() || '0',
          securityAlerts: data.performance?.errors?.by_type?.security?.toString() || '0',
          lastScan: new Date().toLocaleString(),
        });
      } catch (error) {
        console.error('Error fetching security metrics:', error);
        setError('Failed to load security metrics. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityMetrics();
    const interval = setInterval(fetchSecurityMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    analyticsAPI.getMetrics()
      .then(response => {
        const data = response.data || {};
        setMetrics({
          activeUsers: data.active_users?.toString() || '0',
          failedLogins: data.performance?.errors?.total?.toString() || '0',
          securityAlerts: data.performance?.errors?.by_type?.security?.toString() || '0',
          lastScan: new Date().toLocaleString(),
        });
      })
      .catch(error => {
        console.error('Error refreshing security metrics:', error);
        setError('Failed to refresh security metrics. Please try again later.');
      })
      .finally(() => setLoading(false));
  };

  // Mock data - replace with actual API calls
  const recentActivities = [
    {
      action: 'Login attempt',
      user: 'john.doe@example.com',
      ip: '192.168.1.100',
      timestamp: '2024-02-20 14:30:00',
      status: 'success',
    },
    {
      action: 'Password change',
      user: 'jane.smith@example.com',
      ip: '192.168.1.101',
      timestamp: '2024-02-20 13:15:00',
      status: 'success',
    },
    {
      action: 'Failed login',
      user: 'unknown',
      ip: '192.168.1.102',
      timestamp: '2024-02-20 12:45:00',
      status: 'failed',
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Security Dashboard</Typography>
        <Tooltip title="Refresh metrics">
          <IconButton onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <SecurityMetric
            title="Active Users"
            value={metrics.activeUsers}
            icon={<SecurityIcon color="primary" />}
            color="primary"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SecurityMetric
            title="Failed Login Attempts"
            value={metrics.failedLogins}
            icon={<LockIcon color="error" />}
            color="error"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SecurityMetric
            title="Security Alerts"
            value={metrics.securityAlerts}
            icon={<WarningIcon color="warning" />}
            color="warning"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SecurityMetric
            title="Last Security Scan"
            value={metrics.lastScan}
            icon={<ShieldIcon color="success" />}
            color="success"
            loading={loading}
          />
        </Grid>
      </Grid>

      <Typography variant="h4" gutterBottom>
        Security Settings
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Authentication" />
            <Divider />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.twoFactorAuth}
                        onChange={handleSettingChange('twoFactorAuth')}
                      />
                    }
                    label="Two-Factor Authentication"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.passwordExpiry}
                        onChange={handleSettingChange('passwordExpiry')}
                      />
                    }
                    label="Password Expiry (90 days)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Session Timeout (minutes)"
                    value={securitySettings.sessionTimeout}
                    onChange={handleTimeoutChange}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Access Control" />
            <Divider />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.ipWhitelist}
                        onChange={handleSettingChange('ipWhitelist')}
                      />
                    }
                    label="IP Whitelist"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.auditLogging}
                        onChange={handleSettingChange('auditLogging')}
                      />
                    }
                    label="Audit Logging"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<VpnKeyIcon />}
                    fullWidth
                  >
                    Manage API Keys
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Security Activities
            </Typography>
            <List>
              {recentActivities.map((activity, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <IconButton edge="end" aria-label="delete">
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    {activity.status === 'success' ? (
                      <LockIcon color="success" />
                    ) : (
                      <LockIcon color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={activity.action}
                    secondary={
                      <>
                        <Typography component="span" variant="body2">
                          User: {activity.user}
                        </Typography>
                        <br />
                        <Typography component="span" variant="body2">
                          IP: {activity.ip} | Time: {activity.timestamp}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<HistoryIcon />}
              >
                View Full Audit Log
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Security; 