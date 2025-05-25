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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Accuracy as AccuracyIcon,
} from '@mui/icons-material';
import { useMLService } from '../contexts/MLServiceContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

function MLService() {
  const {
    models,
    activeModel,
    loading,
    error,
    inferenceResults,
    modelMetrics,
    isProcessing,
    setActiveModel,
    runInference,
    getModelMetrics,
    updateModelSettings,
    trainModel,
    deployModel,
    refreshModels,
  } = useMLService();

  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [trainingData, setTrainingData] = useState('');
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);

  useEffect(() => {
    if (activeModel) {
      getModelMetrics(activeModel.id);
    }
  }, [activeModel]);

  const handleModelChange = (event) => {
    const model = models.find((m) => m.id === event.target.value);
    setActiveModel(model);
  };

  const handleRunInference = async () => {
    if (!input.trim()) return;
    await runInference(input);
  };

  const handleSettingsOpen = (model) => {
    setSelectedModel(model);
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    setSelectedModel(null);
  };

  const handleTrainingOpen = (model) => {
    setSelectedModel(model);
    setTrainingDialogOpen(true);
  };

  const handleTrainingClose = () => {
    setTrainingDialogOpen(false);
    setSelectedModel(null);
    setTrainingData('');
  };

  const handleTrainModel = async () => {
    if (!trainingData.trim()) return;
    await trainModel(selectedModel.id, trainingData);
    handleTrainingClose();
  };

  const handleDeployModel = async (modelId) => {
    await deployModel(modelId);
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
        <Typography variant="h4">ML Service</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Select Model</InputLabel>
            <Select
              value={activeModel?.id || ''}
              onChange={handleModelChange}
              label="Select Model"
            >
              {models.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={refreshModels}>
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
        {/* Model Metrics */}
        {modelMetrics && (
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Model Performance" />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <MemoryIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {modelMetrics.memoryUsage}MB
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Memory Usage
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <SpeedIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {modelMetrics.inferenceTime}ms
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Avg. Inference Time
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AccuracyIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {modelMetrics.accuracy}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Accuracy
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TimelineIcon sx={{ mr: 1 }} />
                      <Box>
                        <Typography variant="h6">
                          {modelMetrics.requestsPerMinute}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Requests/Minute
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Inference Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Run Inference" />
            <CardContent>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter input for inference..."
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                startIcon={isProcessing ? <StopIcon /> : <PlayIcon />}
                onClick={handleRunInference}
                disabled={isProcessing || !input.trim()}
              >
                {isProcessing ? 'Processing...' : 'Run Inference'}
              </Button>
              {isProcessing && (
                <LinearProgress sx={{ mt: 2 }} />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Results Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Recent Results" />
            <CardContent>
              <List>
                {inferenceResults.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="No results yet"
                      secondary="Run inference to see results"
                    />
                  </ListItem>
                ) : (
                  inferenceResults.map((result) => (
                    <React.Fragment key={result.id}>
                      <ListItem>
                        <ListItemText
                          primary={result.output}
                          secondary={new Date(result.timestamp).toLocaleString()}
                        />
                        <ListItemSecondaryAction>
                          <Typography variant="body2" color="text.secondary">
                            {result.confidence}%
                          </Typography>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Models List */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Available Models" />
            <CardContent>
              <List>
                {models.map((model) => (
                  <React.Fragment key={model.id}>
                    <ListItem>
                      <ListItemText
                        primary={model.name}
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.primary"
                            >
                              {model.type}
                            </Typography>
                            {' — '}
                            {model.description}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Settings">
                          <IconButton
                            edge="end"
                            onClick={() => handleSettingsOpen(model)}
                            sx={{ mr: 1 }}
                          >
                            <SettingsIcon />
                          </IconButton>
                        </Tooltip>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleTrainingOpen(model)}
                          sx={{ mr: 1 }}
                        >
                          Train
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleDeployModel(model.id)}
                          disabled={model.status === 'deployed'}
                        >
                          {model.status === 'deployed' ? 'Deployed' : 'Deploy'}
                        </Button>
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

      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={handleSettingsClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Model Settings</DialogTitle>
        <DialogContent>
          {selectedModel && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Model Name"
                value={selectedModel.name}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                value={selectedModel.description}
                multiline
                rows={2}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedModel.status}
                  label="Status"
                >
                  <MenuItem value="idle">Idle</MenuItem>
                  <MenuItem value="training">Training</MenuItem>
                  <MenuItem value="deployed">Deployed</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Cancel</Button>
          <Button variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Training Dialog */}
      <Dialog
        open={trainingDialogOpen}
        onClose={handleTrainingClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Train Model</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={trainingData}
            onChange={(e) => setTrainingData(e.target.value)}
            placeholder="Enter training data..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTrainingClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleTrainModel}
            disabled={!trainingData.trim()}
          >
            Start Training
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MLService; 