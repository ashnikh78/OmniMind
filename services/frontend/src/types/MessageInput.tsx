import React, { useState } from 'react';
import { Box, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  isLoading: boolean;
  onTemplateSelect: (template: string) => void;
  onAIAssist: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, isLoading, onTemplateSelect, onAIAssist }) => {
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (input.trim() === '') return;
    await onSend(input);
    setInput('');
  };

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <TextField
        fullWidth
        placeholder="Type a message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') handleSend();
        }}
      />
      <IconButton onClick={handleSend} disabled={isLoading}>
        <SendIcon />
      </IconButton>
    </Box>
  );
};

export default MessageInput;
