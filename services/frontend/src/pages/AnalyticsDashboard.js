import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Paper,
  useTheme,
  useMediaQuery,
  Breadcrumbs,
  Link,
  Chip,
  Stack,
  Divider,
  Fade,
  Zoom,
  Skeleton,
  alpha,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  FilterList as FilterListIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useAnalytics } from '../contexts/AnalyticsContext';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

function AnalyticsDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const {
    metrics,
    loading,
    error,
    timeRange,
    refreshInterval,
    setTimeRange,
    setRefreshInterval,
    getUserActivity,
    getSystemPerformance,
    getUsageStats,
    getErrorRates,
    exportAnalytics,
    refreshAnalytics,
  } = useAnalytics();

  const [activeTab, setActiveTab] = useState(0);
  const [chartData, setChartData] = useState({
    userActivity: [],
    systemPerformance: [],
    usageStats: [],
    errorRates: [],
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(['activeUsers', 'newUsers']);

  useEffect(() => {
    fetchAllData();
  }, [timeRange]);

  const fetchAllData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [userActivity, systemPerformance, usageStats, errorRates] =
        await Promise.all([
          getUserActivity({ timeRange }),
          getSystemPerformance({ timeRange }),
          getUsageStats({ timeRange }),
          getErrorRates({ timeRange }),
        ]);

      setChartData({
        userActivity,
        systemPerformance,
        usageStats,
        errorRates,
      });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [timeRange, getUserActivity, getSystemPerformance, getUsageStats, getErrorRates]);

  const handleExport = async (format) => {
    try {
      await exportAnalytics(format, { timeRange });
    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleMetricToggle = (metric) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric]
    );
  };

  const renderBreadcrumbs = () => (
    <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
      <Link
        color="inherit"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate('/');
        }}
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
        Home
      </Link>
      <Typography
        sx={{ display: 'flex', alignItems: 'center' }}
        color="text.primary"
      >
        <AnalyticsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
        Analytics
      </Typography>
    </Breadcrumbs>
  );

  const renderHeader = () => (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Analytics Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor system performance, user activity, and usage statistics
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Refresh</InputLabel>
            <Select
              value={refreshInterval / 1000}
              onChange={(e) => setRefreshInterval(e.target.value * 1000)}
              label="Refresh"
            >
              <MenuItem value={30}>30s</MenuItem>
              <MenuItem value={60}>1m</MenuItem>
              <MenuItem value={300}>5m</MenuItem>
              <MenuItem value={600}>10m</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh Data">
            <span>
              <IconButton
                onClick={refreshAnalytics}
                disabled={isRefreshing}
                color="primary"
              >
                <RefreshIcon className={isRefreshing ? 'rotating' : ''} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Export Data">
            <IconButton onClick={() => handleExport('csv')} color="primary">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Filter Metrics">
            <IconButton
              onClick={() => setShowFilters(!showFilters)}
              color={showFilters ? 'primary' : 'default'}
            >
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
      {showFilters && (
        <Fade in={showFilters}>
          <Paper
            sx={{
              p: 2,
              mt: 2,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="subtitle2" sx={{ width: '100%', mb: 1 }}>
              Select Metrics to Display:
            </Typography>
            <Chip
              label="Active Users"
              onClick={() => handleMetricToggle('activeUsers')}
              color={selectedMetrics.includes('activeUsers') ? 'primary' : 'default'}
              variant={selectedMetrics.includes('activeUsers') ? 'filled' : 'outlined'}
            />
            <Chip
              label="New Users"
              onClick={() => handleMetricToggle('newUsers')}
              color={selectedMetrics.includes('newUsers') ? 'primary' : 'default'}
              variant={selectedMetrics.includes('newUsers') ? 'filled' : 'outlined'}
            />
            <Chip
              label="CPU Usage"
              onClick={() => handleMetricToggle('cpu')}
              color={selectedMetrics.includes('cpu') ? 'primary' : 'default'}
              variant={selectedMetrics.includes('cpu') ? 'filled' : 'outlined'}
            />
            <Chip
              label="Memory Usage"
              onClick={() => handleMetricToggle('memory')}
              color={selectedMetrics.includes('memory') ? 'primary' : 'default'}
              variant={selectedMetrics.includes('memory') ? 'filled' : 'outlined'}
            />
          </Paper>
        </Fade>
      )}
    </Box>
  );

  const renderSummaryCards = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <Zoom in={!loading}>
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    mr: 2,
                  }}
                >
                  <PeopleIcon />
                </Avatar>
                <Box>
                  {loading ? (
                    <Skeleton variant="text" width={60} />
                  ) : (
                    <Typography variant="h4">
                      {metrics.userActivity.length}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Active Users
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Zoom>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Zoom in={!loading} style={{ transitionDelay: '100ms' }}>
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.main,
                    mr: 2,
                  }}
                >
                  <SpeedIcon />
                </Avatar>
                <Box>
                  {loading ? (
                    <Skeleton variant="text" width={60} />
                  ) : (
                    <Typography variant="h4">
                      {metrics.systemPerformance.responseTime || 0}ms
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Avg Response Time
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Zoom>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Zoom in={!loading} style={{ transitionDelay: '200ms' }}>
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    color: theme.palette.warning.main,
                    mr: 2,
                  }}
                >
                  <TimelineIcon />
                </Avatar>
                <Box>
                  {loading ? (
                    <Skeleton variant="text" width={60} />
                  ) : (
                    <Typography variant="h4">
                      {metrics.usageStats.totalRequests || 0}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Total Requests
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Zoom>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Zoom in={!loading} style={{ transitionDelay: '300ms' }}>
          <Card
            sx={{
              height: '100%',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    color: theme.palette.error.main,
                    mr: 2,
                  }}
                >
                  <ErrorIcon />
                </Avatar>
                <Box>
                  {loading ? (
                    <Skeleton variant="text" width={60} />
                  ) : (
                    <Typography variant="h4">
                      {metrics.errorRates.errorRate || 0}%
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Error Rate
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Zoom>
      </Grid>
    </Grid>
  );

  const renderCharts = () => (
    <Card sx={{ mt: 3 }}>
      <CardHeader
        title="Analytics"
        action={
          <Tooltip title="Chart Settings">
            <IconButton>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        <Box sx={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 0 && (
              <AreaChart data={chartData.userActivity}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={theme.palette.primary.main}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={theme.palette.primary.main}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.1)}
                />
                <XAxis
                  dataKey="timestamp"
                  stroke={theme.palette.text.secondary}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <YAxis
                  stroke={theme.palette.text.secondary}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: theme.shape.borderRadius,
                  }}
                />
                <Legend />
                {selectedMetrics.includes('activeUsers') && (
                  <Area
                    type="monotone"
                    dataKey="activeUsers"
                    stroke={theme.palette.primary.main}
                    fillOpacity={1}
                    fill="url(#colorActive)"
                    name="Active Users"
                  />
                )}
                {selectedMetrics.includes('newUsers') && (
                  <Area
                    type="monotone"
                    dataKey="newUsers"
                    stroke={theme.palette.success.main}
                    fill={theme.palette.success.main}
                    fillOpacity={0.3}
                    name="New Users"
                  />
                )}
              </AreaChart>
            )}

            {activeTab === 1 && (
              <LineChart data={chartData.systemPerformance}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.1)}
                />
                <XAxis
                  dataKey="timestamp"
                  stroke={theme.palette.text.secondary}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <YAxis
                  stroke={theme.palette.text.secondary}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: theme.shape.borderRadius,
                  }}
                />
                <Legend />
                {selectedMetrics.includes('cpu') && (
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke={theme.palette.primary.main}
                    name="CPU Usage"
                    strokeWidth={2}
                  />
                )}
                {selectedMetrics.includes('memory') && (
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke={theme.palette.success.main}
                    name="Memory Usage"
                    strokeWidth={2}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke={theme.palette.warning.main}
                  name="Response Time"
                  strokeWidth={2}
                />
              </LineChart>
            )}

            {activeTab === 2 && (
              <BarChart data={chartData.usageStats}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.1)}
                />
                <XAxis
                  dataKey="endpoint"
                  stroke={theme.palette.text.secondary}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <YAxis
                  stroke={theme.palette.text.secondary}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: theme.shape.borderRadius,
                  }}
                />
                <Legend />
                <Bar
                  dataKey="requests"
                  fill={theme.palette.primary.main}
                  name="Requests"
                />
                <Bar
                  dataKey="errors"
                  fill={theme.palette.error.main}
                  name="Errors"
                />
              </BarChart>
            )}

            {activeTab === 3 && (
              <PieChart>
                <Pie
                  data={chartData.errorRates}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  label
                >
                  {chartData.errorRates.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: theme.shape.borderRadius,
                  }}
                />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading && !isRefreshing) {
    return (
      <Box sx={{ p: 3 }}>
        {renderBreadcrumbs()}
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {renderBreadcrumbs()}
      {renderHeader()}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={refreshAnalytics}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          centered={!isMobile}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 64,
            },
          }}
        >
          <Tab
            icon={<PeopleIcon />}
            label="User Activity"
            iconPosition="start"
          />
          <Tab
            icon={<SpeedIcon />}
            label="System Performance"
            iconPosition="start"
          />
          <Tab
            icon={<TimelineIcon />}
            label="Usage Stats"
            iconPosition="start"
          />
          <Tab
            icon={<ErrorIcon />}
            label="Error Rates"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {renderSummaryCards()}
      {renderCharts()}
    </Box>
  );
}

export default AnalyticsDashboard; 