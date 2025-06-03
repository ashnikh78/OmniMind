// services/frontend/src/components/Chat/ConversationHistory.tsx
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography } from '@mui/material';

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

interface Conversation {
  id: string;
  messages: Message[];
}

interface ConversationHistoryProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onUpdateConversation: (conversationId: string, updated: Conversation) => void;
  onShareConversation: (conversationId: string) => void;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  open,
  onClose,
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onShareConversation,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Conversation History</DialogTitle>
      <DialogContent>
        {conversations.length === 0 ? (
          <Typography>No conversations available.</Typography>
        ) : (
          conversations.map((conv) => (
            <Box key={conv.id} sx={{ mb: 2 }}>
              <Typography>Conversation {conv.id}</Typography>
              <Button onClick={() => onSelectConversation(conv.id)}>Select</Button>
              <Button onClick={() => onDeleteConversation(conv.id)}>Delete</Button>
              <Button onClick={() => onShareConversation(conv.id)}>Share</Button>
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConversationHistory;