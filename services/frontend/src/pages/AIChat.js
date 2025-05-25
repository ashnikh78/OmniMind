import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  CircularProgress,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Stack,
  Tooltip,
  useTheme,
  alpha,
  Fade,
  Zoom,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as ContentCopyIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { wsManager } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { chatAPI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function AIChat() {
  const theme = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama2');
  const [availableModels, setAvailableModels] = useState([]);
  const [modelSettings, setModelSettings] = useState({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    fetchAvailableModels();
    setupWebSocket();

    return () => {
      wsManager.offMessage('chat_message', handleNewMessage);
    };
  }, []);

  const setupWebSocket = () => {
    wsManager.onMessage('chat_message', handleNewMessage);
  };

  const handleNewMessage = (message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
    scrollToBottom();
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await chatAPI.getHistory();
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('/api/ollama/models');
      const models = await response.json();
      setAvailableModels(models);
    } catch (error) {
      console.error('Error fetching available models:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const message = {
        content: newMessage,
        timestamp: new Date().toISOString(),
        model: selectedModel,
        settings: modelSettings,
      };

      await chatAPI.sendMessage(message);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Handle file upload
      const formData = new FormData();
      formData.append('file', file);
      // Upload file and send message with file reference
    }
  };

  const handleMenuClick = (event, message) => {
    setAnchorEl(event.currentTarget);
    setSelectedMessage(message);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMessage(null);
  };

  const handleEditClick = () => {
    if (selectedMessage) {
      setEditMessage(selectedMessage.content);
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDeleteClick = async () => {
    if (selectedMessage) {
      try {
        await chatAPI.deleteMessage(selectedMessage.id);
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== selectedMessage.id)
        );
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
    handleMenuClose();
  };

  const handleCopyClick = () => {
    if (selectedMessage) {
      navigator.clipboard.writeText(selectedMessage.content);
    }
    handleMenuClose();
  };

  const handleEditSave = async () => {
    if (selectedMessage && editMessage.trim()) {
      try {
        await chatAPI.updateMessage(selectedMessage.id, {
          content: editMessage,
        });
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === selectedMessage.id
              ? { ...msg, content: editMessage }
              : msg
          )
        );
        setEditDialogOpen(false);
      } catch (error) {
        console.error('Error updating message:', error);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const renderMessage = (message) => {
    const isUser = message.sender_id === user.id;
    const isAI = message.sender_id === 'ai';

    return (
      <ListItem
        alignItems="flex-start"
        sx={{
          flexDirection: isUser ? 'row-reverse' : 'row',
          mb: 2,
        }}
      >
        <ListItemAvatar>
          <Avatar
            sx={{
              bgcolor: isAI
                ? alpha(theme.palette.primary.main, 0.1)
                : alpha(theme.palette.secondary.main, 0.1),
              color: isAI
                ? theme.palette.primary.main
                : theme.palette.secondary.main,
            }}
          >
            {isAI ? <BotIcon /> : <PersonIcon />}
          </Avatar>
        </ListItemAvatar>
        <Box
          sx={{
            maxWidth: '70%',
            ml: isUser ? 0 : 2,
            mr: isUser ? 2 : 0,
          }}
        >
          <Paper
            elevation={1}
            sx={{
              p: 2,
              bgcolor: isAI
                ? alpha(theme.palette.primary.main, 0.05)
                : alpha(theme.palette.secondary.main, 0.05),
              borderRadius: 2,
            }}
          >
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </Paper>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.5, display: 'block' }}
          >
            {formatDistanceToNow(new Date(message.timestamp), {
              addSuffix: true,
            })}
          </Typography>
        </Box>
      </ListItem>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h5" gutterBottom>
            AI Chat
          </Typography>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Model</InputLabel>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                label="Model"
              >
                {availableModels.map((model) => (
                  <MenuItem key={model.name} value={model.name}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Model Settings">
              <IconButton onClick={() => setSettingsOpen(true)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchMessages}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>

      <Paper
        ref={chatContainerRef}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <List>
          {messages.map((message, index) => (
            <React.Fragment key={message.id || index}>
              {renderMessage(message)}
            </React.Fragment>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            variant="outlined"
            size="small"
          />
          <Tooltip title="Attach File">
            <IconButton onClick={() => fileInputRef.current?.click()}>
              <AttachFileIcon />
            </IconButton>
          </Tooltip>
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Tooltip title="Send Message">
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
            >
              <SendIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Model Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Temperature</InputLabel>
              <Select
                value={modelSettings.temperature}
                onChange={(e) =>
                  setModelSettings({
                    ...modelSettings,
                    temperature: e.target.value,
                  })
                }
                label="Temperature"
              >
                <MenuItem value={0.1}>0.1 (More Focused)</MenuItem>
                <MenuItem value={0.3}>0.3</MenuItem>
                <MenuItem value={0.5}>0.5</MenuItem>
                <MenuItem value={0.7}>0.7 (Default)</MenuItem>
                <MenuItem value={0.9}>0.9</MenuItem>
                <MenuItem value={1.0}>1.0 (More Creative)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Max Tokens</InputLabel>
              <Select
                value={modelSettings.maxTokens}
                onChange={(e) =>
                  setModelSettings({
                    ...modelSettings,
                    maxTokens: e.target.value,
                  })
                }
                label="Max Tokens"
              >
                <MenuItem value={512}>512</MenuItem>
                <MenuItem value={1024}>1024</MenuItem>
                <MenuItem value={2048}>2048 (Default)</MenuItem>
                <MenuItem value={4096}>4096</MenuItem>
                <MenuItem value={8192}>8192</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Top P</InputLabel>
              <Select
                value={modelSettings.topP}
                onChange={(e) =>
                  setModelSettings({
                    ...modelSettings,
                    topP: e.target.value,
                  })
                }
                label="Top P"
              >
                <MenuItem value={0.1}>0.1 (More Focused)</MenuItem>
                <MenuItem value={0.3}>0.3</MenuItem>
                <MenuItem value={0.5}>0.5</MenuItem>
                <MenuItem value={0.7}>0.7</MenuItem>
                <MenuItem value={0.9}>0.9 (Default)</MenuItem>
                <MenuItem value={1.0}>1.0 (More Creative)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Message</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditClick}>
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
        <MenuItem onClick={handleCopyClick}>
          <ContentCopyIcon sx={{ mr: 1 }} /> Copy
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default AIChat; 