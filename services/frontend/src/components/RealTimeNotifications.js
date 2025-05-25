import React, { useState, useEffect } from 'react';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import websocketService from '../services/websocket';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

function RealTimeNotifications() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, token } = useAuth();

  useEffect(() => {
    // Connect to WebSocket
    websocketService.connect(user, token);

    // Subscribe to notification events
    websocketService.subscribe('notification', handleNotification);

    // Cleanup on unmount
    return () => {
      websocketService.unsubscribe('notification', handleNotification);
      websocketService.disconnect();
    };
  }, [user, token]);

  const handleNotification = (message) => {
    const { data } = message;
    setNotifications(prev => [data, ...prev].slice(0, 50)); // Keep last 50 notifications
    setUnreadCount(prev => prev + 1);
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setUnreadCount(0); // Mark all as read when opening
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '📢';
    }
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ ml: 1 }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 400,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Notifications</Typography>
        </Box>
        <Divider />
        <List sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No notifications"
                sx={{ textAlign: 'center', color: 'text.secondary' }}
              />
            </ListItem>
          ) : (
            notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{getNotificationIcon(notification.type)}</span>
                        <Typography variant="body1">{notification.message}</Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </Menu>
    </>
  );
}

export default RealTimeNotifications; 