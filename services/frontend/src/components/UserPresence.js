import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Box,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Person, Circle } from '@mui/icons-material';
import websocketService from '../services/websocket';
import { formatDistanceToNow } from 'date-fns';

function UserPresence() {
  const [onlineUsers, setOnlineUsers] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to presence updates
    websocketService.subscribe('presence', handlePresenceUpdate);
    websocketService.subscribe('analytics', handleAnalyticsUpdate);

    // Initial data fetch
    fetchPresenceData();
    fetchAnalyticsData();

    // Set up polling for analytics
    const analyticsInterval = setInterval(fetchAnalyticsData, 30000);

    return () => {
      websocketService.unsubscribe('presence', handlePresenceUpdate);
      websocketService.unsubscribe('analytics', handleAnalyticsUpdate);
      clearInterval(analyticsInterval);
    };
  }, []);

  const fetchPresenceData = async () => {
    try {
      const response = await fetch('/api/presence');
      const data = await response.json();
      setOnlineUsers(data);
    } catch (error) {
      console.error('Error fetching presence data:', error);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const response = await fetch('/api/analytics/realtime');
      const data = await response.json();
      setAnalytics(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    }
  };

  const handlePresenceUpdate = (message) => {
    setOnlineUsers(message.data);
  };

  const handleAnalyticsUpdate = (message) => {
    setAnalytics(message.data);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'away':
        return 'warning';
      case 'busy':
        return 'error';
      default:
        return 'default';
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
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Online Users ({Object.keys(onlineUsers).length})
      </Typography>
      <List>
        {Object.entries(onlineUsers).map(([userId, user]) => (
          <React.Fragment key={userId}>
            <ListItem>
              <ListItemAvatar>
                <Avatar src={user.avatar}>
                  <Person />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={user.name}
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Circle
                      sx={{
                        fontSize: 12,
                        color: `${getStatusColor(user.status)}.main`,
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {user.role} • Last seen{' '}
                      {formatDistanceToNow(new Date(user.last_seen), {
                        addSuffix: true,
                      })}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            <Divider variant="inset" component="li" />
          </React.Fragment>
        ))}
      </List>

      {analytics && (
        <>
          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            Real-time Analytics
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`Active Users: ${analytics.active_users}`}
              color="primary"
            />
            <Chip
              label={`Total Connections: ${analytics.total_connections}`}
              color="secondary"
            />
            {Object.entries(analytics.user_roles).map(([role, count]) => (
              <Chip
                key={role}
                label={`${role}: ${count}`}
                variant="outlined"
              />
            ))}
          </Box>

          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
            Recent Activities
          </Typography>
          <List dense>
            {analytics.recent_activities.map((activity, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={activity.activity}
                  secondary={formatDistanceToNow(
                    new Date(activity.timestamp),
                    { addSuffix: true }
                  )}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Paper>
  );
}

export default UserPresence; 