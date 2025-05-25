import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
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
  Checkbox,
  FormGroup,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Group as GroupIcon,
  Lock as LockIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useRBAC } from '../contexts/RBACContext';

function RoleManagement() {
  const {
    roles,
    permissions,
    rolePermissions,
    loading,
    error,
    roleStats,
    createRole,
    updateRole,
    deleteRole,
    getRolePermissions,
    updateRolePermissions,
    getRoleStats,
    refreshRoles,
  } = useRBAC();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    type: 'custom',
  });
  const [editRole, setEditRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  useEffect(() => {
    getRoleStats();
  }, []);

  const handleCreateOpen = () => {
    setCreateDialogOpen(true);
  };

  const handleCreateClose = () => {
    setCreateDialogOpen(false);
    setNewRole({
      name: '',
      description: '',
      type: 'custom',
    });
  };

  const handleEditOpen = (role) => {
    setSelectedRole(role);
    setEditRole({ ...role });
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedRole(null);
    setEditRole(null);
  };

  const handlePermissionsOpen = async (role) => {
    setSelectedRole(role);
    const rolePerms = await getRolePermissions(role.id);
    setSelectedPermissions(rolePerms.map((p) => p.id));
    setPermissionsDialogOpen(true);
  };

  const handlePermissionsClose = () => {
    setPermissionsDialogOpen(false);
    setSelectedRole(null);
    setSelectedPermissions([]);
  };

  const handleCreateRole = async () => {
    try {
      await createRole(newRole);
      handleCreateClose();
    } catch (error) {
      console.error('Error creating role:', error);
    }
  };

  const handleUpdateRole = async () => {
    try {
      await updateRole(selectedRole.id, editRole);
      handleEditClose();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      try {
        await deleteRole(roleId);
      } catch (error) {
        console.error('Error deleting role:', error);
      }
    }
  };

  const handleUpdatePermissions = async () => {
    try {
      await updateRolePermissions(selectedRole.id, selectedPermissions);
      handlePermissionsClose();
    } catch (error) {
      console.error('Error updating permissions:', error);
    }
  };

  const handlePermissionToggle = (permissionId) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Role Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateOpen}
          >
            Create Role
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={refreshRoles}>
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
        {/* Role Stats */}
        {roleStats && (
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Role Statistics" />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <GroupIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {roleStats.totalRoles}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Roles
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PersonIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {roleStats.totalUsers}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Users with Roles
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LockIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {roleStats.totalPermissions}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Permissions
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AssignmentIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {roleStats.activeAssignments}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Assignments
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Roles List */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Roles" />
            <CardContent>
              <List>
                {roles.map((role) => (
                  <React.Fragment key={role.id}>
                    <ListItem>
                      <ListItemText
                        primary={role.name}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.primary"
                            >
                              {role.type}
                            </Typography>
                            {' — '}
                            {role.description}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Permissions">
                          <IconButton
                            edge="end"
                            onClick={() => handlePermissionsOpen(role)}
                            sx={{ mr: 1 }}
                          >
                            <SecurityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            edge="end"
                            onClick={() => handleEditOpen(role)}
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteRole(role.id)}
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

      {/* Create Role Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleCreateClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Role</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={newRole.name}
              onChange={(e) =>
                setNewRole((prev) => ({ ...prev, name: e.target.value }))
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              value={newRole.description}
              onChange={(e) =>
                setNewRole((prev) => ({ ...prev, description: e.target.value }))
              }
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={newRole.type}
                onChange={(e) =>
                  setNewRole((prev) => ({ ...prev, type: e.target.value }))
                }
                label="Type"
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateRole}
            disabled={!newRole.name.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleEditClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Role</DialogTitle>
        <DialogContent>
          {editRole && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Name"
                value={editRole.name}
                onChange={(e) =>
                  setEditRole((prev) => ({ ...prev, name: e.target.value }))
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                value={editRole.description}
                onChange={(e) =>
                  setEditRole((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                multiline
                rows={2}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={editRole.type}
                  onChange={(e) =>
                    setEditRole((prev) => ({ ...prev, type: e.target.value }))
                  }
                  label="Type"
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateRole}
            disabled={!editRole?.name.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog
        open={permissionsDialogOpen}
        onClose={handlePermissionsClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Role Permissions</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormGroup>
              {permissions.map((permission) => (
                <FormControlLabel
                  key={permission.id}
                  control={
                    <Checkbox
                      checked={selectedPermissions.includes(permission.id)}
                      onChange={() => handlePermissionToggle(permission.id)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">{permission.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {permission.description}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </FormGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePermissionsClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdatePermissions}
            disabled={!selectedRole}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RoleManagement; 