import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Menu,
  MenuItem,
  Badge,
} from '@mui/material';
import {
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import websocketService from '../services/websocket';
import { formatDistanceToNow } from 'date-fns';

function LiveChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Subscribe to chat messages
    websocketService.subscribe('chat', handleChatMessage);
    websocketService.subscribe('chat_typing', handleTypingStatus);

    // Load chat history
    fetchChatHistory();

    return () => {
      websocketService.unsubscribe('chat', handleChatMessage);
      websocketService.unsubscribe('chat_typing', handleTypingStatus);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchChatHistory = async () => {
    try {
      const response = await fetch('/api/chat/history');
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  const handleChatMessage = (message) => {
    const { data } = message;
    setMessages(prev => [...prev, data]);
    if (data.sender_id !== user.id) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const handleTypingStatus = (message) => {
    const { data } = message;
    // Update typing indicator for the user
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.sender_id === data.user_id) {
        return [...prev.slice(0, -1), { ...lastMessage, isTyping: data.isTyping }];
      }
      return prev;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      type: 'chat',
      data: {
        sender_id: user.id,
        sender_name: user.name,
        content: newMessage,
        timestamp: new Date().toISOString(),
      },
    };

    if (selectedUser) {
      websocketService.sendPersonalMessage(selectedUser.id, message);
    } else {
      websocketService.broadcast(message);
    }

    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const message = {
        type: 'chat',
        data: {
          sender_id: user.id,
          sender_name: user.name,
          content: 'Sent a file',
          file: {
            name: file.name,
            type: file.type,
            data: e.target.result,
          },
          timestamp: new Date().toISOString(),
        },
      };

      if (selectedUser) {
        websocketService.sendPersonalMessage(selectedUser.id, message);
      } else {
        websocketService.broadcast(message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleUserSelect = (selectedUser) => {
    setSelectedUser(selectedUser);
    setUnreadCount(0);
    handleMenuClose();
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">
          {selectedUser ? `Chat with ${selectedUser.name}` : 'Global Chat'}
        </Typography>
      </Box>

      <List sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {messages.map((message, index) => (
          <React.Fragment key={index}>
            <ListItem
              alignItems="flex-start"
              sx={{
                flexDirection: message.sender_id === user.id ? 'row-reverse' : 'row',
              }}
            >
              <ListItemAvatar>
                <Avatar src={message.sender_avatar}>
                  {message.sender_name[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      justifyContent:
                        message.sender_id === user.id ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Typography variant="subtitle2">
                      {message.sender_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(message.timestamp), {
                        addSuffix: true,
                      })}
                    </Typography>
                  </Box>
                }
                secondary={
                  message.file ? (
                    <Box
                      sx={{
                        mt: 1,
                        p: 1,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2">
                        📎 {message.file.name}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography
                      variant="body1"
                      sx={{
                        bgcolor: message.sender_id === user.id ? 'primary.light' : 'grey.100',
                        p: 1,
                        borderRadius: 1,
                        maxWidth: '70%',
                      }}
                    >
                      {message.content}
                    </Typography>
                  )
                }
              />
            </ListItem>
            {message.isTyping && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 7 }}>
                {message.sender_name} is typing...
              </Typography>
            )}
            <Divider variant="inset" component="li" />
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} />
      </List>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
          >
            <AttachFileIcon />
          </IconButton>
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
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
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <SendIcon />
          </IconButton>
          <IconButton onClick={handleMenuClick}>
            <Badge badgeContent={unreadCount} color="error">
              <MoreVertIcon />
            </Badge>
          </IconButton>
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleUserSelect(null)}>
          Global Chat
        </MenuItem>
        <Divider />
        {/* Add user list here */}
      </Menu>
    </Paper>
  );
}

export default LiveChat; 