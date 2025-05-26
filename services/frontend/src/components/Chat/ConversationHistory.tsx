import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  TextField,
  Button,
  Divider,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Chat as ChatIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Save as SaveIcon,
  Share as ShareIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Folder as FolderIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  isStarred: boolean;
  tags: string[];
  folder?: string;
}

interface ConversationHistoryProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onUpdateConversation: (id: string, updates: Partial<Conversation>) => void;
  onShareConversation: (id: string) => void;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  open,
  onClose,
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onUpdateConversation,
  onShareConversation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConversation, setEditingConversation] = useState<Conversation | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedId(id);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedId(null);
  };

  const handleEdit = () => {
    const conversation = conversations.find(c => c.id === selectedId);
    if (conversation) {
      setEditingConversation(conversation);
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedId) {
      onDeleteConversation(selectedId);
    }
    handleMenuClose();
  };

  const handleShare = () => {
    if (selectedId) {
      onShareConversation(selectedId);
    }
    handleMenuClose();
  };

  const handleSaveEdit = () => {
    if (editingConversation) {
      onUpdateConversation(editingConversation.id, editingConversation);
    }
    setEditDialogOpen(false);
    setEditingConversation(null);
  };

  const filteredConversations = conversations.filter(conversation =>
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversation.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 360,
          bgcolor: 'background.paper'
        }
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Conversations
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
        />
      </Box>

      <Divider />

      <List sx={{ flex: 1, overflow: 'auto' }}>
        {filteredConversations.map((conversation) => (
          <ListItem
            key={conversation.id}
            button
            onClick={() => onSelectConversation(conversation.id)}
            sx={{
              borderLeft: 4,
              borderColor: conversation.isStarred ? 'warning.main' : 'transparent'
            }}
          >
            <ListItemIcon>
              <ChatIcon />
            </ListItemIcon>
            <ListItemText
              primary={conversation.title}
              secondary={
                <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2" noWrap>
                    {conversation.lastMessage}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(conversation.timestamp, 'MMM d, yyyy HH:mm')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    {conversation.tags.map((tag, index) => (
                      <Typography
                        key={index}
                        variant="caption"
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.7rem'
                        }}
                      >
                        {tag}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={(e) => handleMenuOpen(e, conversation.id)}
              >
                <MoreVertIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleShare}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Conversation</DialogTitle>
        <DialogContent>
          {editingConversation && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Title"
                value={editingConversation.title}
                onChange={(e) => setEditingConversation(prev => ({
                  ...prev!,
                  title: e.target.value
                }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Tags"
                value={editingConversation.tags.join(', ')}
                onChange={(e) => setEditingConversation(prev => ({
                  ...prev!,
                  tags: e.target.value.split(',').map(tag => tag.trim())
                }))}
                helperText="Separate tags with commas"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Folder"
                value={editingConversation.folder || ''}
                onChange={(e) => setEditingConversation(prev => ({
                  ...prev!,
                  folder: e.target.value
                }))}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
};

export default ConversationHistory; 