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
  ListItemIcon,
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
  Badge,
  Tooltip,
  Alert,
  Grid,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';
import {
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Archive as ArchiveIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { messageAPI } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';

function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const [newConversationUser, setNewConversationUser] = useState('');
  const messagesEndRef = useRef(null);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await messageAPI.getConversations();
      setConversations(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch conversations');
      toast.error('Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      setLoading(true);
      const response = await messageAPI.getMessages({ conversationId });
      setMessages(response.data);
      setError(null);
      scrollToBottom();
    } catch (err) {
      setError('Failed to fetch messages');
      toast.error('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !attachment) return;

    try {
      const formData = new FormData();
      formData.append('content', newMessage);
      if (attachment) {
        formData.append('attachment', attachment);
      }
      formData.append('conversationId', selectedConversation.id);

      await messageAPI.sendMessage(formData);
      setNewMessage('');
      setAttachment(null);
      fetchMessages(selectedConversation.id);
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
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
        await messageAPI.deleteMessage(selectedMessage.id);
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
        await messageAPI.updateMessage(selectedMessage.id, {
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

  const handleNewConversation = async () => {
    if (!newConversationUser.trim()) return;

    try {
      const response = await messageAPI.createConversation({
        participant: newConversationUser,
      });
      setConversations((prev) => [...prev, response.conversation]);
      setSelectedConversation(response.conversation);
      setNewConversationDialogOpen(false);
      setNewConversationUser('');
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      await messageAPI.deleteMessage(messageToDelete.id);
      setMessages(messages.filter(msg => msg.id !== messageToDelete.id));
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
      toast.success('Message deleted successfully');
    } catch (err) {
      toast.error('Failed to delete message');
    }
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAttachment(file);
    }
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };

  const handleSortChange = (event) => {
    setSort(event.target.value);
  };

  if (loading && !selectedConversation) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      {/* Conversations List */}
      <Paper
        sx={{
          width: 300,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Messages</Typography>
          <Box sx={{ display: 'flex', mt: 2 }}>
            <TextField
              size="small"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={handleSearch}
              fullWidth
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
            <Tooltip title="New Conversation">
              <IconButton
                onClick={() => setNewConversationDialogOpen(true)}
                sx={{ ml: 1 }}
              >
                <PersonAddIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <List sx={{ flexGrow: 1, overflow: 'auto' }}>
          {conversations
            .filter((conv) =>
              conv.participant.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((conversation) => (
              <ListItem
                key={conversation.id}
                button
                selected={selectedConversation?.id === conversation.id}
                onClick={() => setSelectedConversation(conversation)}
              >
                <ListItemAvatar>
                  <Badge
                    color="success"
                    variant="dot"
                    invisible={!conversation.participant.online}
                  >
                    <Avatar src={conversation.participant.avatar} />
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={conversation.participant.name}
                  secondary={conversation.last_message?.content}
                  secondaryTypographyProps={{
                    noWrap: true,
                  }}
                />
              </ListItem>
            ))}
        </List>
      </Paper>

      {/* Messages Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedConversation ? (
          <>
            <Paper sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  src={selectedConversation.participant.avatar}
                  sx={{ mr: 2 }}
                />
                <Box>
                  <Typography variant="subtitle1">
                    {selectedConversation.participant.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedConversation.participant.online
                      ? 'Online'
                      : 'Last seen ' +
                        formatDistanceToNow(
                          new Date(selectedConversation.participant.last_seen),
                          { addSuffix: true }
                        )}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Paper
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
                        flexDirection:
                          message.sender_id === user.id ? 'row-reverse' : 'row',
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
                          <Typography variant="body1">
                            {message.content}
                          </Typography>
                          {message.attachment && (
                            <Box sx={{ mt: 1 }}>
                              <img
                                src={message.attachment}
                                alt="attachment"
                                style={{ maxWidth: '100%', borderRadius: 4 }}
                              />
                            </Box>
                          )}
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
                    {index < messages.length - 1 && (
                      <Divider variant="inset" component="li" />
                    )}
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
              <input
                type="file"
                id="attachment"
                style={{ display: 'none' }}
                onChange={handleAttachmentChange}
              />
              <label htmlFor="attachment">
                <IconButton component="span">
                  <ContentCopyIcon />
                </IconButton>
              </label>
              <Button
                variant="contained"
                endIcon={<SendIcon />}
                onClick={handleSendMessage}
                disabled={!newMessage.trim() && !attachment}
              >
                Send
              </Button>
            </Paper>
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Typography variant="h6" color="text.secondary">
              Select a conversation to start messaging
            </Typography>
          </Box>
        )}
      </Box>

      {/* Message Actions Menu */}
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

      {/* Edit Message Dialog */}
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

      {/* New Conversation Dialog */}
      <Dialog
        open={newConversationDialogOpen}
        onClose={() => setNewConversationDialogOpen(false)}
      >
        <DialogTitle>New Conversation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Username or Email"
            value={newConversationUser}
            onChange={(e) => setNewConversationUser(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewConversationDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleNewConversation}
            variant="contained"
            disabled={!newConversationUser.trim()}
          >
            Start Conversation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Message Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Message</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this message? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteMessage}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Messages; 