import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Avatar,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import CollaborativeEditor from '../components/CollaborativeEditor';

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [openShareDialog, setOpenShareDialog] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [documentHistory, setDocumentHistory] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/api/v1/documents');
      setDocuments(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch documents');
      setLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    try {
      const newDocument = {
        title: newDocumentTitle,
        content: '',
        owner_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        collaborators: [],
      };
      const response = await api.post('/api/v1/documents', newDocument);
      setDocuments([...documents, response.data]);
      setOpenNewDialog(false);
      setNewDocumentTitle('');
    } catch (err) {
      setError('Failed to create document');
    }
  };

  const handleShareDocument = async () => {
    try {
      const collaborator = {
        id: shareEmail,
        email: shareEmail,
        role: 'editor',
      };
      await api.post(`/api/v1/documents/collaborators/${selectedDocument.id}`, collaborator);
      setOpenShareDialog(false);
      setShareEmail('');
      fetchDocuments();
    } catch (err) {
      setError('Failed to share document');
    }
  };

  const handleRemoveCollaborator = async (documentId, collaboratorId) => {
    try {
      await api.delete(`/api/v1/documents/collaborators/${documentId}/${collaboratorId}`);
      fetchDocuments();
    } catch (err) {
      setError('Failed to remove collaborator');
    }
  };

  const handleViewHistory = async (documentId) => {
    try {
      const response = await api.get(`/api/v1/documents/${documentId}/history`);
      setDocumentHistory(response.data);
      setOpenHistoryDialog(true);
    } catch (err) {
      setError('Failed to fetch document history');
    }
  };

  const handleOpenDocument = (document) => {
    setSelectedDocument(document);
  };

  if (selectedDocument) {
    return (
      <Box sx={{ p: 3 }}>
        <Button
          startIcon={<EditIcon />}
          onClick={() => setSelectedDocument(null)}
          sx={{ mb: 2 }}
        >
          Back to Documents
        </Button>
        <CollaborativeEditor document={selectedDocument} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Documents</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenNewDialog(true)}
        >
          New Document
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Grid container spacing={3}>
        {documents.map((document) => (
          <Grid item xs={12} md={6} lg={4} key={document.id}>
            <Paper
              sx={{
                p: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography variant="h6" gutterBottom>
                {document.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Last updated: {new Date(document.updated_at).toLocaleString()}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Collaborators:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {document.collaborators.map((collaborator) => (
                    <Chip
                      key={collaborator.id}
                      avatar={<Avatar>{collaborator.email[0]}</Avatar>}
                      label={collaborator.email}
                      onDelete={() =>
                        handleRemoveCollaborator(document.id, collaborator.id)
                      }
                    />
                  ))}
                </Box>
              </Box>
              <Box sx={{ mt: 'auto', display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => handleOpenDocument(document)}
                >
                  Edit
                </Button>
                <IconButton
                  onClick={() => {
                    setSelectedDocument(document);
                    setOpenShareDialog(true);
                  }}
                >
                  <ShareIcon />
                </IconButton>
                <IconButton onClick={() => handleViewHistory(document.id)}>
                  <HistoryIcon />
                </IconButton>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* New Document Dialog */}
      <Dialog open={openNewDialog} onClose={() => setOpenNewDialog(false)}>
        <DialogTitle>Create New Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Document Title"
            fullWidth
            value={newDocumentTitle}
            onChange={(e) => setNewDocumentTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateDocument} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Document Dialog */}
      <Dialog open={openShareDialog} onClose={() => setOpenShareDialog(false)}>
        <DialogTitle>Share Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenShareDialog(false)}>Cancel</Button>
          <Button onClick={handleShareDocument} variant="contained">
            Share
          </Button>
        </DialogActions>
      </Dialog>

      {/* Document History Dialog */}
      <Dialog
        open={openHistoryDialog}
        onClose={() => setOpenHistoryDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Document History</DialogTitle>
        <DialogContent>
          <List>
            {documentHistory.map((entry, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemText
                    primary={entry.type}
                    secondary={`By: ${entry.user_id} at ${new Date(
                      entry.timestamp
                    ).toLocaleString()}`}
                  />
                </ListItem>
                {index < documentHistory.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Documents; 