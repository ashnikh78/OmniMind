import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Alert,
  Chip,
  TextField,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

function Roles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newRole, setNewRole] = useState({ name: '', permissions: [] });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/v1/rbac/roles');
      setRoles(response.data.roles);
    } catch (error) {
      setError('Failed to load roles');
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    try {
      const response = await api.post('/api/v1/rbac/roles', newRole);
      setRoles([...roles, response.data]);
      setNewRole({ name: '', permissions: [] });
    } catch (err) {
      console.error('Failed to add role:', err);
      setError('Failed to add role');
    }
  };

  const handleEdit = (role) => {
    console.log('Edit role:', role);
    // Implement edit modal or inline editing
  };

  const handleDelete = async (roleId) => {
    try {
      await api.delete(`/api/v1/rbac/roles/${roleId}`);
      setRoles(roles.filter((r) => r.id !== roleId));
    } catch (err) {
      console.error('Failed to delete role:', err);
      setError('Failed to delete role');
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
        <Typography variant="h4">Roles</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddRole}
        >
          Add Role
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 3, mb: 3 }}>
        <Typography variant="h6">Add New Role</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
          <TextField
            label="Role Name"
            value={newRole.name}
            onChange={(e) =>
              setNewRole({ ...newRole, name: e.target.value })
            }
          />
          <TextField
            label="Permissions (comma separated)"
            value={newRole.permissions.join(', ')}
            onChange={(e) =>
              setNewRole({
                ...newRole,
                permissions: e.target.value
                  .split(',')
                  .map((p) => p.trim())
                  .filter(Boolean),
              })
            }
          />
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>{role.id}</TableCell>
                <TableCell>{role.name}</TableCell>
                <TableCell>
                  {role.permissions.map((permission) => (
                    <Chip
                      key={permission}
                      label={permission}
                      size="small"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => handleEdit(role)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(role.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default Roles;
