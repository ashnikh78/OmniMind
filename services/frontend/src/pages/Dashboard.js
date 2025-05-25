import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Message as MessageIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await dashboardAPI.getDashboardData();
      setStats(response.stats);
      setRecentActivity(response.recentActivity);
    } catch (error) {
      setError('Failed to load dashboard data');
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Dashboard</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchDashboardData}>
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
        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <MessageIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4">{stats?.messages || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Messages
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <NotificationsIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4">{stats?.notifications || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Notifications
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <PersonIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4">{stats?.connections || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Connections
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <TimelineIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4">{stats?.activities || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Activities
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Recent Activity"
              action={
                <Button
                  size="small"
                  endIcon={<TrendingUpIcon />}
                  onClick={() => window.location.href = '/activity'}
                >
                  View All
                </Button>
              }
            />
            <CardContent>
              <List>
                {recentActivity.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar src={activity.user.avatar}>
                          {activity.user.username[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.description}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.primary"
                            >
                              {activity.user.username}
                            </Typography>
                            {' — '}
                            {new Date(activity.timestamp).toLocaleString()}
                          </>
                        }
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Quick Stats" />
            <CardContent>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Profile Completion"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ flexGrow: 1, mr: 1 }}>
                          <CircularProgress
                            variant="determinate"
                            value={stats?.profileCompletion || 0}
                            size={20}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {stats?.profileCompletion || 0}%
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Last Login"
                    secondary={new Date(stats?.lastLogin || Date.now()).toLocaleString()}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Account Status"
                    secondary={
                      <Typography
                        component="span"
                        variant="body2"
                        color={stats?.accountStatus === 'active' ? 'success.main' : 'error.main'}
                      >
                        {stats?.accountStatus || 'Unknown'}
                      </Typography>
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard; 