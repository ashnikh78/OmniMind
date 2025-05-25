import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  IconButton,
  Tooltip,
  Chip,
  Avatar,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Save as SaveIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import websocketService from '../services/websocket';
import { formatDistanceToNow } from 'date-fns';
import { Editor } from '@tinymce/tinymce-react';

function CollaborativeEditor() {
  const { user } = useAuth();
  const [document, setDocument] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [editingUsers, setEditingUsers] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [newCollaborator, setNewCollaborator] = useState('');
  const editorRef = useRef(null);

  useEffect(() => {
    // Subscribe to document updates
    websocketService.subscribe('document_update', handleDocumentUpdate);
    websocketService.subscribe('user_editing', handleUserEditing);
    websocketService.subscribe('document_history', handleHistoryUpdate);

    // Load document data
    fetchDocument();

    return () => {
      websocketService.unsubscribe('document_update', handleDocumentUpdate);
      websocketService.unsubscribe('user_editing', handleUserEditing);
      websocketService.unsubscribe('document_history', handleHistoryUpdate);
    };
  }, []);

  const fetchDocument = async () => {
    try {
      const response = await fetch('/api/documents/current');
      const data = await response.json();
      setDocument(data);
      setTitle(data.title);
      setContent(data.content);
      setCollaborators(data.collaborators);
      setHistory(data.history);
    } catch (error) {
      console.error('Error fetching document:', error);
    }
  };

  const handleDocumentUpdate = (message) => {
    const { data } = message;
    if (data.user_id !== user.id) {
      setContent(data.content);
    }
  };

  const handleUserEditing = (message) => {
    const { data } = message;
    setEditingUsers(prev => {
      const newSet = new Set(prev);
      if (data.isEditing) {
        newSet.add(data.user_id);
      } else {
        newSet.delete(data.user_id);
      }
      return newSet;
    });
  };

  const handleHistoryUpdate = (message) => {
    const { data } = message;
    setHistory(prev => [data, ...prev]);
  };

  const handleContentChange = (content) => {
    setContent(content);
    websocketService.send({
      type: 'document_update',
      data: {
        user_id: user.id,
        content,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const handleTitleChange = (event) => {
    const newTitle = event.target.value;
    setTitle(newTitle);
    websocketService.send({
      type: 'document_update',
      data: {
        user_id: user.id,
        title: newTitle,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const handleSave = async () => {
    try {
      await fetch('/api/documents/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
        }),
      });
    } catch (error) {
      console.error('Error saving document:', error);
    }
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const handleAddCollaborator = async () => {
    if (!newCollaborator) return;

    try {
      const response = await fetch('/api/documents/collaborators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newCollaborator,
        }),
      });
      const data = await response.json();
      setCollaborators(prev => [...prev, data]);
      setNewCollaborator('');
      setShareDialogOpen(false);
    } catch (error) {
      console.error('Error adding collaborator:', error);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId) => {
    try {
      await fetch(`/api/documents/collaborators/${collaboratorId}`, {
        method: 'DELETE',
      });
      setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
    } catch (error) {
      console.error('Error removing collaborator:', error);
    }
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            value={title}
            onChange={handleTitleChange}
            variant="standard"
            fullWidth
            placeholder="Document Title"
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Save">
              <IconButton onClick={handleSave}>
                <SaveIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton onClick={handleShare}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="History">
              <IconButton>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          {Array.from(editingUsers).map(userId => (
            <Chip
              key={userId}
              avatar={<Avatar><PersonIcon /></Avatar>}
              label={`User ${userId} is editing`}
              size="small"
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, p: 2 }}>
        <Editor
          apiKey="your-tinymce-api-key"
          onInit={(evt, editor) => editorRef.current = editor}
          value={content}
          onEditorChange={handleContentChange}
          init={{
            height: '100%',
            menubar: true,
            plugins: [
              'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
              'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
              'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
            ],
            toolbar: 'undo redo | blocks | ' +
              'bold italic forecolor | alignleft aligncenter ' +
              'alignright alignjustify | bullist numlist outdent indent | ' +
              'removeformat | help',
            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
          }}
        />
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" gutterBottom>
          Collaborators
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {collaborators.map(collaborator => (
            <Chip
              key={collaborator.id}
              avatar={<Avatar src={collaborator.avatar}>{collaborator.name[0]}</Avatar>}
              label={collaborator.name}
              onDelete={() => handleRemoveCollaborator(collaborator.id)}
            />
          ))}
        </Box>
      </Box>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}>
        <DialogTitle>Share Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            value={newCollaborator}
            onChange={(e) => setNewCollaborator(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddCollaborator} variant="contained">
            Add Collaborator
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default CollaborativeEditor; 