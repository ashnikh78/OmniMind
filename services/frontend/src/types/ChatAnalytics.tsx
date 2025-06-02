import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography } from '@mui/material';

interface ChatAnalyticsProps {
  open: boolean;
  onClose: () => void;
  stats: {
    userMessageCount: number;
    aiMessageCount: number;
    sentimentCounts: Record<string, number>;
  };
}

const ChatAnalytics: React.FC<ChatAnalyticsProps> = ({ open, onClose, stats }) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Analytics</DialogTitle>
      <DialogContent>
        <Typography>User Messages: {stats.userMessageCount}</Typography>
        <Typography>AI Messages: {stats.aiMessageCount}</Typography>
        <Typography>Sentiment Breakdown:</Typography>
        {Object.entries(stats.sentimentCounts).map(([sentiment, count]) => (
          <Typography key={sentiment}>
            {sentiment}: {count}
          </Typography>
        ))}
      </DialogContent>
    </Dialog>
  );
};

export default ChatAnalytics;
