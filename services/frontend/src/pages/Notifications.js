import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../contexts/NotificationContext';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'success':
      return <CheckCircleIcon color="success" />;
    case 'error':
      return <ErrorIcon color="error" />;
    case 'warning':
      return <WarningIcon color="warning" />;
    default:
      return <InfoIcon color="info" />;
  }
};

function Notifications() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    preferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    refreshNotifications,
  } = useNotifications();

  const [openPreferences, setOpenPreferences] = useState(false);
  const [localPreferences, setLocalPreferences] = useState(preferences);

  const handleOpenPreferences = () => {
    setLocalPreferences(preferences);
    setOpenPreferences(true);
  };

  const handleClosePreferences = () => {
    setOpenPreferences(false);
  };

  const handleSavePreferences = async () => {
    await updatePreferences(localPreferences);
    handleClosePreferences();
  };

  const handlePreferenceChange = (name) => (event) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [name]: event.target.checked,
    }));
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
        <Typography variant="h4">Notifications</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refreshNotifications}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={handleOpenPreferences}
          >
            Preferences
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="contained"
              onClick={markAllAsRead}
            >
              Mark All as Read
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <List>
        {notifications.length === 0 ? (
          <ListItem>
            <ListItemText
              primary="No notifications"
              secondary="You're all caught up!"
            />
          </ListItem>
        ) : (
          notifications.map((notification) => (
            <React.Fragment key={notification.id}>
              <ListItem
                sx={{
                  bgcolor: notification.read ? 'inherit' : 'action.hover',
                }}
              >
                <ListItemIcon>
                  {getNotificationIcon(notification.type)}
                </ListItemIcon>
                <ListItemText
                  primary={notification.message}
                  secondary={
                    <>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                      >
                        {notification.title}
                      </Typography>
                      {' — '}
                      {formatDistanceToNow(new Date(notification.timestamp), {
                        addSuffix: true,
                      })}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  {!notification.read && (
                    <Tooltip title="Mark as read">
                      <IconButton
                        edge="end"
                        onClick={() => markAsRead(notification.id)}
                        sx={{ mr: 1 }}
                      >
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <IconButton
                      edge="end"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))
        )}
      </List>

      <Dialog
        open={openPreferences}
        onClose={handleClosePreferences}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Notification Preferences</DialogTitle>
        <DialogContent>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={localPreferences.email}
                  onChange={handlePreferenceChange('email')}
                />
              }
              label="Email Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={localPreferences.push}
                  onChange={handlePreferenceChange('push')}
                />
              }
              label="Push Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={localPreferences.inApp}
                  onChange={handlePreferenceChange('inApp')}
                />
              }
              label="In-App Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={localPreferences.sound}
                  onChange={handlePreferenceChange('sound')}
                />
              }
              label="Notification Sound"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreferences}>Cancel</Button>
          <Button onClick={handleSavePreferences} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Notifications; 