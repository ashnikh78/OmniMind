import React, { useState, useCallback } from 'react';
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Task {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Delayed';
  priority: 'Low' | 'Medium' | 'High';
  assignedTo: string;
  dependencies: string[];
  progress: number;
}

const ProjectManagementTool: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      name: 'Project Planning',
      description: 'Initial project setup and planning',
      startDate: new Date(2024, 0, 1),
      endDate: new Date(2024, 0, 15),
      status: 'Completed',
      priority: 'High',
      assignedTo: 'John Doe',
      dependencies: [],
      progress: 100,
    },
    {
      id: '2',
      name: 'Development Phase',
      description: 'Core development work',
      startDate: new Date(2024, 0, 16),
      endDate: new Date(2024, 1, 15),
      status: 'In Progress',
      priority: 'High',
      assignedTo: 'Jane Smith',
      dependencies: ['1'],
      progress: 60,
    },
  ]);

  const [newTask, setNewTask] = useState<Partial<Task>>({
    name: '',
    description: '',
    status: 'Not Started',
    priority: 'Medium',
    assignedTo: '',
    dependencies: [],
    progress: 0,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateTask = useCallback((task: Partial<Task>): boolean => {
    if (!task.name?.trim()) {
      setError('Task name is required');
      return false;
    }
    if (!task.startDate) {
      setError('Start date is required');
      return false;
    }
    if (!task.endDate) {
      setError('End date is required');
      return false;
    }
    if (task.startDate > task.endDate) {
      setError('End date must be after start date');
      return false;
    }
    const progress = task.progress ?? 0;
    if (progress < 0 || progress > 100) {
      setError('Progress must be between 0 and 100');
      return false;
    }
    return true;
  }, []);

  const handleAddTask = useCallback(() => {
    if (validateTask(newTask)) {
      const task: Task = {
        id: Date.now().toString(),
        name: newTask.name!,
        description: newTask.description || '',
        startDate: newTask.startDate!,
        endDate: newTask.endDate!,
        status: newTask.status as Task['status'],
        priority: newTask.priority as Task['priority'],
        assignedTo: newTask.assignedTo || '',
        dependencies: newTask.dependencies || [],
        progress: newTask.progress || 0,
      };
      setTasks(prev => [...prev, task]);
      setNewTask({
        name: '',
        description: '',
        status: 'Not Started',
        priority: 'Medium',
        assignedTo: '',
        dependencies: [],
        progress: 0,
      });
      setIsDialogOpen(false);
    }
  }, [newTask, validateTask]);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setNewTask(task);
    setIsDialogOpen(true);
  }, []);

  const handleUpdateTask = useCallback(() => {
    if (validateTask(newTask)) {
      setTasks(prev =>
        prev.map(task =>
          task.id === editingTask?.id
            ? {
                ...task,
                ...newTask,
                startDate: newTask.startDate!,
                endDate: newTask.endDate!,
              }
            : task
        )
      );
      setEditingTask(null);
      setNewTask({
        name: '',
        description: '',
        status: 'Not Started',
        priority: 'Medium',
        assignedTo: '',
        dependencies: [],
        progress: 0,
      });
      setIsDialogOpen(false);
    }
  }, [editingTask, newTask, validateTask]);

  const handleDeleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  }, []);

  const getStatusColor = useCallback((status: Task['status']) => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'In Progress':
        return 'info';
      case 'Delayed':
        return 'error';
      default:
        return 'default';
    }
  }, []);

  const getPriorityColor = useCallback((priority: Task['priority']) => {
    switch (priority) {
      case 'High':
        return 'error';
      case 'Medium':
        return 'warning';
      default:
        return 'success';
    }
  }, []);

  const exportProjectData = useCallback(() => {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        tasks: tasks.map(task => ({
          ...task,
          startDate: task.startDate.toISOString(),
          endDate: task.endDate.toISOString(),
        })),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setError('Error exporting project data');
    }
  }, [tasks]);

  const importProjectData = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.tasks) {
            setTasks(
              data.tasks.map((task: any) => ({
                ...task,
                startDate: new Date(task.startDate),
                endDate: new Date(task.endDate),
              }))
            );
          }
        } catch (error) {
          setError('Error importing project data');
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const calculateProjectProgress = useCallback(() => {
    if (tasks.length === 0) return 0;
    const totalProgress = tasks.reduce((sum, task) => sum + (task.progress || 0), 0);
    return Math.round(totalProgress / tasks.length);
  }, [tasks]);

  const handleDateChange = useCallback((field: 'startDate' | 'endDate') => (date: Date | null) => {
    if (date) {
      setNewTask(prev => ({ ...prev, [field]: date }));
    }
  }, []);

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Project Management</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingTask(null);
                    setNewTask({
                      name: '',
                      description: '',
                      status: 'Not Started',
                      priority: 'Medium',
                      assignedTo: '',
                      dependencies: [],
                      progress: 0,
                    });
                    setIsDialogOpen(true);
                  }}
                >
                  Add Task
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={exportProjectData}
                >
                  Export
                </Button>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                >
                  Import
                  <input
                    type="file"
                    hidden
                    accept=".json"
                    onChange={importProjectData}
                  />
                </Button>
              </Stack>
            </Box>
            <Typography variant="subtitle1" gutterBottom>
              Overall Progress: {calculateProjectProgress()}%
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Task Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>{task.name}</TableCell>
                    <TableCell>{task.description}</TableCell>
                    <TableCell>{task.startDate.toLocaleDateString()}</TableCell>
                    <TableCell>{task.endDate.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={task.status}
                        color={getStatusColor(task.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={task.priority}
                        color={getPriorityColor(task.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{task.assignedTo}</TableCell>
                    <TableCell>{task.progress}%</TableCell>
                    <TableCell>
                      <Tooltip title="Edit Task">
                        <IconButton
                          size="small"
                          onClick={() => handleEditTask(task)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Task">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteTask(task.id)}
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
              Project Timeline
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tasks}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="progress" fill="#8884d8" name="Progress" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTask ? 'Edit Task' : 'Add New Task'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Task Name"
                value={newTask.name}
                onChange={(e) => setNewTask(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={newTask.startDate}
                  onChange={handleDateChange('startDate')}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={newTask.endDate}
                  onChange={handleDateChange('endDate')}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={newTask.status}
                  onChange={(e) => setNewTask(prev => ({ ...prev, status: e.target.value as Task['status'] }))}
                >
                  <MenuItem value="Not Started">Not Started</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                  <MenuItem value="Delayed">Delayed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newTask.priority}
                  onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Assigned To"
                value={newTask.assignedTo}
                onChange={(e) => setNewTask(prev => ({ ...prev, assignedTo: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Progress (%)"
                value={newTask.progress}
                onChange={(e) => setNewTask(prev => ({ ...prev, progress: Number(e.target.value) }))}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={editingTask ? handleUpdateTask : handleAddTask}
          >
            {editingTask ? 'Update' : 'Add'} Task
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProjectManagementTool; 