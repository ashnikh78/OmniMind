import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Avatar,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Language as LanguageIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  Interests as InterestsIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { profileAPI } from '../services/api';

function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await profileAPI.getProfile();
      setProfile(response.profile);
      setEditedProfile(response.profile);
    } catch (error) {
      setError('Failed to load profile');
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile(profile);
    setAvatarFile(null);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const response = await profileAPI.updateProfile({
        ...editedProfile,
        formData,
      });

      setProfile(response.profile);
      setIsEditing(false);
      setAvatarFile(null);
    } catch (error) {
      setError('Failed to update profile');
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field) => (event) => {
    setEditedProfile({
      ...editedProfile,
      [field]: event.target.value,
    });
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditedProfile({
          ...editedProfile,
          avatar: reader.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                src={editedProfile?.avatar}
                alt={editedProfile?.username}
                sx={{ width: 150, height: 150, mb: 2 }}
              />
              {isEditing && (
                <IconButton
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    bgcolor: 'background.paper',
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleAvatarChange}
                  />
                  <PhotoCameraIcon />
                </IconButton>
              )}
            </Box>
            <Typography variant="h5" gutterBottom>
              {editedProfile?.username}
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {editedProfile?.bio}
            </Typography>
            {isEditing ? (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  sx={{ mr: 1 }}
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleEdit}
                sx={{ mt: 2 }}
              >
                Edit Profile
              </Button>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardHeader title="Personal Information" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Username"
                        value={editedProfile?.username || ''}
                        onChange={handleInputChange('username')}
                        disabled={!isEditing}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Email"
                        value={editedProfile?.email || ''}
                        onChange={handleInputChange('email')}
                        disabled={!isEditing}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Bio"
                        multiline
                        rows={4}
                        value={editedProfile?.bio || ''}
                        onChange={handleInputChange('bio')}
                        disabled={!isEditing}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardHeader title="Contact Information" />
                <CardContent>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <EmailIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Email"
                        secondary={editedProfile?.email}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemIcon>
                        <PhoneIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Phone"
                        secondary={editedProfile?.phone || 'Not provided'}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemIcon>
                        <LocationIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Location"
                        secondary={editedProfile?.location || 'Not provided'}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardHeader title="Professional Information" />
                <CardContent>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <WorkIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Occupation"
                        secondary={editedProfile?.occupation || 'Not provided'}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemIcon>
                        <SchoolIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Education"
                        secondary={editedProfile?.education || 'Not provided'}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemIcon>
                        <LanguageIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Languages"
                        secondary={
                          editedProfile?.languages?.length > 0 ? (
                            <Box sx={{ mt: 1 }}>
                              {editedProfile.languages.map((language) => (
                                <Chip
                                  key={language}
                                  label={language}
                                  size="small"
                                  sx={{ mr: 1, mb: 1 }}
                                />
                              ))}
                            </Box>
                          ) : (
                            'Not provided'
                          )
                        }
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemIcon>
                        <InterestsIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Interests"
                        secondary={
                          editedProfile?.interests?.length > 0 ? (
                            <Box sx={{ mt: 1 }}>
                              {editedProfile.interests.map((interest) => (
                                <Chip
                                  key={interest}
                                  label={interest}
                                  size="small"
                                  sx={{ mr: 1, mb: 1 }}
                                />
                              ))}
                            </Box>
                          ) : (
                            'Not provided'
                          )
                        }
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Profile; 