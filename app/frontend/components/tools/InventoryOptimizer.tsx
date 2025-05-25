import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  reorderPoint: number;
  leadTime: number;
  cost: number;
}

const InventoryOptimizer: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { id: '1', name: 'Product A', quantity: 100, reorderPoint: 50, leadTime: 7, cost: 10 },
    { id: '2', name: 'Product B', quantity: 75, reorderPoint: 30, leadTime: 5, cost: 15 },
    { id: '3', name: 'Product C', quantity: 200, reorderPoint: 100, leadTime: 10, cost: 8 }
  ]);

  const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id'>>({
    name: '',
    quantity: 0,
    reorderPoint: 0,
    leadTime: 0,
    cost: 0
  });

  const calculateEOQ = (item: InventoryItem) => {
    // Economic Order Quantity formula
    const annualDemand = item.quantity * 12; // Assuming monthly quantity
    const orderingCost = 50; // Fixed ordering cost
    const holdingCost = item.cost * 0.2; // 20% of item cost
    return Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
  };

  const calculateSafetyStock = (item: InventoryItem) => {
    // Safety stock formula with 95% service level
    const demandVariability = item.quantity * 0.1; // 10% variability
    const leadTimeVariability = item.leadTime * 0.2; // 20% variability
    const serviceLevel = 1.645; // 95% service level
    return serviceLevel * Math.sqrt(leadTimeVariability * demandVariability);
  };

  const addItem = () => {
    if (newItem.name && newItem.quantity > 0) {
      setInventory(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          ...newItem
        }
      ]);
      setNewItem({
        name: '',
        quantity: 0,
        reorderPoint: 0,
        leadTime: 0,
        cost: 0
      });
    }
  };

  const deleteItem = (id: string) => {
    setInventory(prev => prev.filter(item => item.id !== id));
  };

  const exportInventoryReport = () => {
    const report = {
      date: new Date().toISOString(),
      inventory: inventory.map(item => ({
        ...item,
        eoq: calculateEOQ(item),
        safetyStock: calculateSafetyStock(item),
        totalCost: item.quantity * item.cost
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Add New Item
              </Typography>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={exportInventoryReport}
              >
                Export Report
              </Button>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Item Name"
                  value={newItem.name}
                  onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Quantity"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Reorder Point"
                  value={newItem.reorderPoint}
                  onChange={(e) => setNewItem(prev => ({ ...prev, reorderPoint: Number(e.target.value) }))}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addItem}
                  sx={{ height: '56px' }}
                >
                  Add Item
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Item Name</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Reorder Point</TableCell>
                  <TableCell align="right">Lead Time (days)</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">EOQ</TableCell>
                  <TableCell align="right">Safety Stock</TableCell>
                  <TableCell align="right">Total Cost</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">{item.reorderPoint}</TableCell>
                    <TableCell align="right">{item.leadTime}</TableCell>
                    <TableCell align="right">${item.cost}</TableCell>
                    <TableCell align="right">{Math.round(calculateEOQ(item))}</TableCell>
                    <TableCell align="right">{Math.round(calculateSafetyStock(item))}</TableCell>
                    <TableCell align="right">${(item.quantity * item.cost).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete Item">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteItem(item.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Inventory Analysis
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={inventory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Line type="monotone" dataKey="quantity" stroke="#8884d8" name="Current Quantity" />
                <Line type="monotone" dataKey="reorderPoint" stroke="#82ca9d" name="Reorder Point" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default InventoryOptimizer; 