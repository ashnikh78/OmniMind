// src/components/ConversationHistory.tsx
import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

interface ConversationHistoryProps {
  open: boolean;
  onClose: () => void;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Conversation History</DialogTitle>
      <DialogContent>
        <p>No conversations available.</p> {/* Replace with actual conversation list */}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConversationHistory;