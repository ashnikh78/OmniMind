import React, { useState, useEffect } from 'react';
import { tenantAPI } from '../services/api';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
  TextField
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

function Tenants() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTenant, setNewTenant] = useState({ name: '' });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/v1/tenants');
      setTenants(response.data.tenants);
    } catch (error) {
      setError('Failed to load tenants');
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTenant = async () => {
    try {
      const response = await tenantAPI.createTenant(newTenant);
      setTenants(prev => [...prev, response.data]);
      setNewTenant({ name: '' });
      toast.success('Tenant added successfully');
    } catch (error) {
      setError('Failed to add tenant');
      console.error('Error adding tenant:', error);
    }
  };

  const handleEdit = (tenant) => {
    // Placeholder logic for editing a tenant
    console.log('Editing tenant:', tenant);
    toast.info(`Edit tenant feature coming soon for ${tenant.name}`);
  };

  const handleDelete = async (tenantId) => {
    if (!window.confirm('Are you sure you want to delete this tenant?')) return;

    try {
      await tenantAPI.deleteTenant(tenantId);
      setTenants(prev => prev.filter(t => t.id !== tenantId));
      toast.success('Tenant deleted successfully');
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Failed to delete tenant');
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
        <Typography variant="h4">Tenants</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            label="Tenant Name"
            value={newTenant.name}
            onChange={(e) => setNewTenant({ name: e.target.value })}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddTenant}
          >
            Add Tenant
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>{tenant.id}</TableCell>
                <TableCell>{tenant.name}</TableCell>
                <TableCell>{tenant.status}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => handleEdit(tenant)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(tenant.id)}
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

export default Tenants;
