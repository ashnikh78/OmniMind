import React, { useState, useEffect, useRef } from 'react';
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
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { wsManager } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { chatAPI } from '../services/api';

function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    fetchMessages();
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

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const message = {
        content: newMessage,
        timestamp: new Date().toISOString(),
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          Chat
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Online Users:
          </Typography>
          {onlineUsers.map((onlineUser) => (
            <Avatar
              key={onlineUser.id}
              alt={onlineUser.name}
              src={onlineUser.avatar}
              sx={{ width: 24, height: 24 }}
            />
          ))}
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
        <List sx={{ flexGrow: 1 }}>
          {messages.map((message, index) => (
            <React.Fragment key={message.id || index}>
              <ListItem
                alignItems="flex-start"
                sx={{
                  flexDirection: message.sender_id === user.id ? 'row-reverse' : 'row',
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    alt={message.sender_name}
                    src={message.sender_avatar}
                    sx={{
                      order: message.sender_id === user.id ? 1 : 0,
                    }}
                  />
                </ListItemAvatar>
                <Box
                  sx={{
                    maxWidth: '70%',
                    ml: message.sender_id === user.id ? 0 : 2,
                    mr: message.sender_id === user.id ? 2 : 0,
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      backgroundColor:
                        message.sender_id === user.id
                          ? 'primary.light'
                          : 'background.paper',
                      color:
                        message.sender_id === user.id
                          ? 'primary.contrastText'
                          : 'text.primary',
                    }}
                  >
                    <Typography variant="body1">{message.content}</Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 1,
                        color:
                          message.sender_id === user.id
                            ? 'primary.contrastText'
                            : 'text.secondary',
                      }}
                    >
                      {formatDistanceToNow(new Date(message.timestamp), {
                        addSuffix: true,
                      })}
                    </Typography>
                  </Paper>
                </Box>
                {message.sender_id === user.id && (
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuClick(e, message)}
                    sx={{ ml: 1 }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                )}
              </ListItem>
              {index < messages.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Paper>

      <Paper
        component="form"
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          borderTop: 1,
          borderColor: 'divider',
        }}
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          variant="outlined"
          size="small"
          sx={{ mr: 2 }}
        />
        <IconButton
          color="primary"
          onClick={handleSendMessage}
          disabled={!newMessage.trim()}
        >
          <SendIcon />
        </IconButton>
      </Paper>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditClick}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyClick}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Message</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            multiline
            rows={4}
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Chat; 