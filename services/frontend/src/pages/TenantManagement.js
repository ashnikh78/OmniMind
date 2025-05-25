import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CardHeader,
  Button,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useTenant } from '../contexts/TenantContext';

function TenantManagement() {
  const {
    tenants,
    activeTenant,
    loading,
    error,
    tenantStats,
    tenantSettings,
    setActiveTenant,
    createTenant,
    updateTenant,
    deleteTenant,
    getTenantStats,
    getTenantSettings,
    updateTenantSettings,
    refreshTenants,
  } = useTenant();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [newTenant, setNewTenant] = useState({
    name: '',
    description: '',
    type: 'organization',
    status: 'active',
  });
  const [editTenant, setEditTenant] = useState(null);

  useEffect(() => {
    if (activeTenant) {
      getTenantStats(activeTenant.id);
      getTenantSettings(activeTenant.id);
    }
  }, [activeTenant]);

  const handleCreateOpen = () => {
    setCreateDialogOpen(true);
  };

  const handleCreateClose = () => {
    setCreateDialogOpen(false);
    setNewTenant({
      name: '',
      description: '',
      type: 'organization',
      status: 'active',
    });
  };

  const handleEditOpen = (tenant) => {
    setSelectedTenant(tenant);
    setEditTenant({ ...tenant });
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedTenant(null);
    setEditTenant(null);
  };

  const handleSettingsOpen = (tenant) => {
    setSelectedTenant(tenant);
    setSettingsDialogOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsDialogOpen(false);
    setSelectedTenant(null);
  };

  const handleCreateTenant = async () => {
    try {
      await createTenant(newTenant);
      handleCreateClose();
    } catch (error) {
      console.error('Error creating tenant:', error);
    }
  };

  const handleUpdateTenant = async () => {
    try {
      await updateTenant(selectedTenant.id, editTenant);
      handleEditClose();
    } catch (error) {
      console.error('Error updating tenant:', error);
    }
  };

  const handleDeleteTenant = async (tenantId) => {
    if (window.confirm('Are you sure you want to delete this tenant?')) {
      try {
        await deleteTenant(tenantId);
      } catch (error) {
        console.error('Error deleting tenant:', error);
      }
    }
  };

  const handleUpdateSettings = async (settings) => {
    try {
      await updateTenantSettings(selectedTenant.id, settings);
      handleSettingsClose();
    } catch (error) {
      console.error('Error updating tenant settings:', error);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Tenant Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateOpen}
          >
            Create Tenant
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={refreshTenants}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Tenant Stats */}
        {tenantStats && (
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Tenant Statistics" />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <BusinessIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {tenantStats.totalOrganizations}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Organizations
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PeopleIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {tenantStats.totalUsers}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Users
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <StorageIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {tenantStats.storageUsed}GB
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Storage Used
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <SecurityIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {tenantStats.activeSessions}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Sessions
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Tenants List */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Tenants" />
            <CardContent>
              <List>
                {tenants.map((tenant) => (
                  <React.Fragment key={tenant.id}>
                    <ListItem>
                      <ListItemText
                        primary={tenant.name}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.primary"
                            >
                              {tenant.type}
                            </Typography>
                            {' — '}
                            {tenant.description}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Settings">
                          <IconButton
                            edge="end"
                            onClick={() => handleSettingsOpen(tenant)}
                            sx={{ mr: 1 }}
                          >
                            <SettingsIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            edge="end"
                            onClick={() => handleEditOpen(tenant)}
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteTenant(tenant.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create Tenant Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCreateClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Tenant</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={newTenant.name}
              onChange={(e) =>
                setNewTenant((prev) => ({ ...prev, name: e.target.value }))
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              value={newTenant.description}
              onChange={(e) =>
                setNewTenant((prev) => ({ ...prev, description: e.target.value }))
              }
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={newTenant.type}
                onChange={(e) =>
                  setNewTenant((prev) => ({ ...prev, type: e.target.value }))
                }
                label="Type"
              >
                <MenuItem value="organization">Organization</MenuItem>
                <MenuItem value="department">Department</MenuItem>
                <MenuItem value="team">Team</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newTenant.status}
                onChange={(e) =>
                  setNewTenant((prev) => ({ ...prev, status: e.target.value }))
                }
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateTenant}
            disabled={!newTenant.name.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleEditClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Tenant</DialogTitle>
        <DialogContent>
          {editTenant && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Name"
                value={editTenant.name}
                onChange={(e) =>
                  setEditTenant((prev) => ({ ...prev, name: e.target.value }))
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                value={editTenant.description}
                onChange={(e) =>
                  setEditTenant((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                multiline
                rows={2}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={editTenant.type}
                  onChange={(e) =>
                    setEditTenant((prev) => ({ ...prev, type: e.target.value }))
                  }
                  label="Type"
                >
                  <MenuItem value="organization">Organization</MenuItem>
                  <MenuItem value="department">Department</MenuItem>
                  <MenuItem value="team">Team</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editTenant.status}
                  onChange={(e) =>
                    setEditTenant((prev) => ({ ...prev, status: e.target.value }))
                  }
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateTenant}
            disabled={!editTenant?.name.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={handleSettingsClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Tenant Settings</DialogTitle>
        <DialogContent>
          {tenantSettings && (
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tenantSettings.enableAnalytics}
                    onChange={(e) =>
                      handleUpdateSettings({
                        ...tenantSettings,
                        enableAnalytics: e.target.checked,
                      })
                    }
                  />
                }
                label="Enable Analytics"
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={tenantSettings.enableNotifications}
                    onChange={(e) =>
                      handleUpdateSettings({
                        ...tenantSettings,
                        enableNotifications: e.target.checked,
                      })
                    }
                  />
                }
                label="Enable Notifications"
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={tenantSettings.enableMLService}
                    onChange={(e) =>
                      handleUpdateSettings({
                        ...tenantSettings,
                        enableMLService: e.target.checked,
                      })
                    }
                  />
                }
                label="Enable ML Service"
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Storage Limit</InputLabel>
                <Select
                  value={tenantSettings.storageLimit}
                  onChange={(e) =>
                    handleUpdateSettings({
                      ...tenantSettings,
                      storageLimit: e.target.value,
                    })
                  }
                  label="Storage Limit"
                >
                  <MenuItem value="10">10 GB</MenuItem>
                  <MenuItem value="50">50 GB</MenuItem>
                  <MenuItem value="100">100 GB</MenuItem>
                  <MenuItem value="500">500 GB</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>User Limit</InputLabel>
                <Select
                  value={tenantSettings.userLimit}
                  onChange={(e) =>
                    handleUpdateSettings({
                      ...tenantSettings,
                      userLimit: e.target.value,
                    })
                  }
                  label="User Limit"
                >
                  <MenuItem value="10">10 Users</MenuItem>
                  <MenuItem value="50">50 Users</MenuItem>
                  <MenuItem value="100">100 Users</MenuItem>
                  <MenuItem value="500">500 Users</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TenantManagement; 