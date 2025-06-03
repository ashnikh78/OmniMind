// services/frontend/src/components/Chat/ChatAnalytics.tsx
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  useTheme,
} from '@mui/material';
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
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    sentiment?: string;
    intent?: string;
    entities?: string[];
  };
};

interface ChatAnalyticsProps {
  messages: Message[];
}

const ChatAnalytics: React.FC<ChatAnalyticsProps> = ({ messages }) => {
  const theme = useTheme();

  const analytics = {
    messageCount: messages.length,
    averageResponseTime: 0,
    tokenUsage: { total: messages.reduce((sum, msg) => sum + msg.content.length, 0) },
    sentimentTrends: messages.map((msg) => ({
      positive: msg.metadata?.sentiment ? parseFloat(msg.metadata.sentiment) : 0,
      negative: msg.metadata?.sentiment ? 1 - parseFloat(msg.metadata.sentiment) : 0,
      timestamp: msg.timestamp.toISOString(),
    })),
    intentDistribution: messages
      .filter((msg) => msg.metadata?.intent)
      .reduce<{ type: string; count: number }[]>((acc, msg) => {
        const intent = msg.metadata!.intent!;
        const existing = acc.find((item) => item.type === intent);
        if (existing) {
          existing.count += 1;
        } else {
          acc.push({ type: intent, count: 1 });
        }
        return acc;
      }, []),
    entityFrequency: messages
      .flatMap((msg) => msg.metadata?.entities || [])
      .reduce<{ type: string; value: string; count: number }[]>((acc, entity) => {
        const existing = acc.find((item) => item.type === entity);
        if (existing) {
          existing.count += 1;
        } else {
          acc.push({ type: entity, value: entity, count: 1 });
        }
        return acc;
      }, []),
  };

  const sentimentData = analytics.sentimentTrends.map((sentiment, index) => ({
    index,
    score: sentiment.positive - sentiment.negative,
    label: sentiment.timestamp,
  }));

  const intentData = analytics.intentDistribution.map(({ type, count }) => ({
    type,
    count,
  }));

  const entityData = analytics.entityFrequency.map(({ type, value, count }) => ({
    type,
    value,
    count,
  }));

  return (
    <Box p={3}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Message Count
            </Typography>
            <Typography variant="h3">{analytics.messageCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Average Response Time
            </Typography>
            <Typography variant="h3">{analytics.averageResponseTime.toFixed(2)}s</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Token Usage
            </Typography>
            <Typography variant="h3">{analytics.tokenUsage.total}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Sentiment Trend
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sentimentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis domain={[-1, 1]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={theme.palette.primary.main}
                  name="Sentiment Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Intent Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={intentData}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {intentData.map((entry, index) => (
                    <Cell key={entry.type} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Entity Frequency
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={entityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="count"
                  fill={theme.palette.secondary.main}
                  name="Frequency"
                />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ChatAnalytics;