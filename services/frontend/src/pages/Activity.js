import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Paper,
  Card,
  CardContent,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  GetApp as DownloadIcon,
  Timeline as TimelineIcon,
  Message as MessageIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useActivity } from '../contexts/ActivityContext';
import { useAuth } from '../contexts/AuthContext';

const getActivityIcon = (type) => {
  switch (type) {
    case 'message':
      return <MessageIcon color="primary" />;
    case 'user':
      return <PersonIcon color="info" />;
    case 'security':
      return <SecurityIcon color="warning" />;
    case 'system':
      return <SettingsIcon color="success" />;
    default:
      return <TimelineIcon color="action" />;
  }
};

function Activity() {
  const {
    activities,
    loading,
    error,
    filters,
    updateFilters,
    refreshActivities,
    getActivityStats,
    exportActivities,
  } = useActivity();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const activityStats = await getActivityStats();
    setStats(activityStats);
  };

  const handleFilterClick = (event) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleExport = async (format) => {
    try {
      const response = await exportActivities(format);
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activities.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting activities:', error);
    }
    handleExportClose();
  };

  const handleFilterChange = (filterType, value) => {
    updateFilters({ [filterType]: value });
    handleFilterClose();
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
        <Typography variant="h4">Activity Feed</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={refreshActivities}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={handleFilterClick}
          >
            Filter
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportClick}
          >
            Export
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Activity Stats */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <TimelineIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{stats.totalActivities}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Activities
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
                    <MessageIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{stats.messageActivities}</Typography>
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
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{stats.userActivities}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      User Actions
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
                    <SecurityIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{stats.securityActivities}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Security Events
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Activity List */}
      <Paper>
        <List>
          {activities.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No activities found"
                secondary="Try adjusting your filters"
              />
            </ListItem>
          ) : (
            activities.map((activity) => (
              <React.Fragment key={activity.id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      {getActivityIcon(activity.type)}
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
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                        })}
                      </>
                    }
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))
          )}
        </List>
      </Paper>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={handleFilterClose}
      >
        <MenuItem>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="message">Messages</MenuItem>
              <MenuItem value="user">User Actions</MenuItem>
              <MenuItem value="security">Security Events</MenuItem>
              <MenuItem value="system">System Events</MenuItem>
            </Select>
          </FormControl>
        </MenuItem>
        <MenuItem>
          <FormControl fullWidth>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            >
              <MenuItem value="1d">Last 24 hours</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="all">All time</MenuItem>
            </Select>
          </FormControl>
        </MenuItem>
      </Menu>

      {/* Export Menu */}
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={handleExportClose}
      >
        <MenuItem onClick={() => handleExport('csv')}>Export as CSV</MenuItem>
        <MenuItem onClick={() => handleExport('json')}>Export as JSON</MenuItem>
        <MenuItem onClick={() => handleExport('pdf')}>Export as PDF</MenuItem>
      </Menu>
    </Box>
  );
}

export default Activity; 