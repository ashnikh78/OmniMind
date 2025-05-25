import React from 'react';
import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Button,
  Box,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';

function StorageCard({ title, used, total, color }) {
  const percentage = (used / total) * 100;
  return (
    <Card>
      <CardHeader title={title} />
      <Divider />
      <CardContent>
        <Typography variant="h4" component="div">
          {used} GB / {total} GB
        </Typography>
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{ mt: 2, height: 10, borderRadius: 5 }}
          color={color}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {percentage.toFixed(1)}% used
        </Typography>
      </CardContent>
    </Card>
  );
}

function Storage() {
  // Mock data - replace with actual API calls
  const storageData = {
    total: {
      used: 45.2,
      total: 100,
    },
    documents: {
      used: 15.8,
      total: 50,
    },
    media: {
      used: 25.4,
      total: 40,
    },
    backups: {
      used: 4.0,
      total: 10,
    },
  };

  const recentFiles = [
    { name: 'project_document.pdf', size: '2.5 MB', type: 'document' },
    { name: 'presentation.pptx', size: '5.1 MB', type: 'document' },
    { name: 'meeting_recording.mp4', size: '150 MB', type: 'media' },
    { name: 'database_backup.zip', size: '1.2 GB', type: 'backup' },
  ];

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Storage Management
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <StorageCard
            title="Total Storage"
            used={storageData.total.used}
            total={storageData.total.total}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StorageCard
            title="Documents"
            used={storageData.documents.used}
            total={storageData.documents.total}
            color="success"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StorageCard
            title="Media Files"
            used={storageData.media.used}
            total={storageData.media.total}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StorageCard
            title="Backups"
            used={storageData.backups.used}
            total={storageData.backups.total}
            color="error"
          />
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Files
            </Typography>
            <List>
              {recentFiles.map((file, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <Box>
                      <IconButton edge="end" aria-label="download">
                        <DownloadIcon />
                      </IconButton>
                      <IconButton edge="end" aria-label="delete">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemIcon>
                    {file.type === 'document' ? <FileIcon /> : <FolderIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={`Size: ${file.size}`}
                  />
                </ListItem>
              ))}
            </List>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" color="primary">
                Upload New File
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default Storage; 