import React, { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  Stack,
  InputAdornment,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  Code as CodeIcon,
  Link as LinkIcon,
  FormatQuote as FormatQuoteIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatListNumbered as FormatListNumberedIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

export interface MessageInputProps {
  onSend: (message: string, files?: File[]) => void;
  isLoading: boolean;
  onTemplateSelect: (template: string) => void;
  onAIAssist: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  isLoading,
  onTemplateSelect,
  onAIAssist,
}) => {
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setAttachedFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const handleSend = () => {
    if (message.trim() || attachedFiles.length > 0) {
      onSend(message.trim(), attachedFiles);
      setMessage('');
      setAttachedFiles([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFormat = (format: string) => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    let newText = message;

    switch (format) {
      case 'bold':
        newText = message.substring(0, start) + `**${selectedText}**` + message.substring(end);
        break;
      case 'italic':
        newText = message.substring(0, start) + `*${selectedText}*` + message.substring(end);
        break;
      case 'code':
        newText = message.substring(0, start) + `\`${selectedText}\`` + message.substring(end);
        break;
      case 'link':
        newText = message.substring(0, start) + `[${selectedText}](url)` + message.substring(end);
        break;
      case 'quote':
        newText = message.substring(0, start) + `> ${selectedText}` + message.substring(end);
        break;
      case 'bullet':
        newText = message.substring(0, start) + `- ${selectedText}` + message.substring(end);
        break;
      case 'numbered':
        newText = message.substring(0, start) + `1. ${selectedText}` + message.substring(end);
        break;
    }

    setMessage(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, end + 2);
    }, 0);
  };

  const templates = [
    { name: 'General Question', content: 'Can you help me with...' },
    { name: 'Code Review', content: 'Please review this code:\n\n```\n\n```' },
    { name: 'Bug Report', content: 'I found a bug in...' },
    { name: 'Feature Request', content: 'I would like to suggest...' },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Paper
        elevation={3}
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {attachedFiles.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            {attachedFiles.map((file, index) => (
              <Chip
                key={index}
                label={file.name}
                onDelete={() =>
                  setAttachedFiles((prev) =>
                    prev.filter((_, i) => i !== index)
                  )
                }
              />
            ))}
          </Stack>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Formatting">
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
            >
              <FormatBoldIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Templates">
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
            >
              <FormatListBulletedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="AI Assist">
            <IconButton onClick={onAIAssist} size="small">
              <SmartToyIcon />
            </IconButton>
          </Tooltip>
          <Box
            {...getRootProps()}
            sx={{
              flex: 1,
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              borderRadius: 1,
              p: 1,
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
              },
            }}
          >
            <input {...getInputProps()} />
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                isDragActive
                  ? 'Drop files here...'
                  : 'Type a message or drag files here...'
              }
              variant="standard"
              InputProps={{
                disableUnderline: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => {
                        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                        input?.click();
                      }}
                      size="small"
                    >
                      <AttachFileIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Tooltip title="Send">
            <span>
              <IconButton
                onClick={handleSend}
                disabled={isLoading || (!message.trim() && attachedFiles.length === 0)}
                color="primary"
              >
                <SendIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Paper>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => handleFormat('bold')}>
          <ListItemIcon>
            <FormatBoldIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Bold</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormat('italic')}>
          <ListItemIcon>
            <FormatItalicIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Italic</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormat('code')}>
          <ListItemIcon>
            <CodeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Code</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormat('link')}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Link</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormat('quote')}>
          <ListItemIcon>
            <FormatQuoteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Quote</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormat('bullet')}>
          <ListItemIcon>
            <FormatListBulletedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Bullet List</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormat('numbered')}>
          <ListItemIcon>
            <FormatListNumberedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Numbered List</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {templates.map((template) => (
          <MenuItem
            key={template.name}
            onClick={() => {
              onTemplateSelect(template.content);
              setAnchorEl(null);
            }}
          >
            <ListItemText primary={template.name} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default MessageInput; 