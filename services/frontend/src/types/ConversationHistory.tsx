import React from 'react';
import { Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText } from '@mui/material';
import { Message } from '../types/model';

interface ConversationHistoryProps {
  open: boolean;
  onClose: () => void;
  history: Message[];
  onSelect: (message: Message) => void;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({ open, onClose, history, onSelect }) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Conversation History</DialogTitle>
      <DialogContent>
        <List>
          {history.map((msg) => (
            <ListItem button key={msg.id} onClick={() => onSelect(msg)}>
              <ListItemText primary={msg.content.slice(0, 50)} secondary={msg.role} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default ConversationHistory;
