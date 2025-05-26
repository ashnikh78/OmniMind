import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Chip,
  Stack,
} from '@mui/material';
import { ChatSettings } from '../../types/chat';
import { mlService } from '../../services/mlService';

interface ChatSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
}

const defaultSettings: ChatSettings = {
  model: 'default-model',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
};

const ChatSettingsDialog: React.FC<ChatSettingsProps> = ({
  open,
  onClose,
  settings,
  onSave,
}) => {
  const [currentSettings, setCurrentSettings] = useState<ChatSettings>(settings);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [newStopSequence, setNewStopSequence] = useState('');

  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await mlService.getModels();
        setAvailableModels(models.map(model => model.id));
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

  const handleChange = (field: keyof ChatSettings, value: any) => {
    setCurrentSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddStopSequence = () => {
    if (newStopSequence.trim()) {
      setCurrentSettings(prev => ({
        ...prev,
        stopSequences: [...prev.stopSequences, newStopSequence.trim()],
      }));
      setNewStopSequence('');
    }
  };

  const handleRemoveStopSequence = (sequence: string) => {
    setCurrentSettings(prev => ({
      ...prev,
      stopSequences: prev.stopSequences.filter(s => s !== sequence),
    }));
  };

  const handleSave = () => {
    onSave(currentSettings);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Chat Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Model Selection */}
          <FormControl fullWidth>
            <InputLabel>Model</InputLabel>
            <Select
              value={currentSettings.model}
              label="Model"
              onChange={(e) => handleChange('model', e.target.value)}
            >
              {availableModels.map(model => (
                <MenuItem key={model} value={model}>
                  {model}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Temperature */}
          <Box>
            <Typography gutterBottom>
              Temperature: {currentSettings.temperature}
            </Typography>
            <Slider
              value={currentSettings.temperature}
              onChange={(_, value) => handleChange('temperature', value)}
              min={0}
              max={1}
              step={0.1}
              marks
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Max Tokens */}
          <TextField
            label="Max Tokens"
            type="number"
            value={currentSettings.maxTokens}
            onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
            fullWidth
            inputProps={{ min: 1, max: 4000 }}
          />

          {/* Top P */}
          <Box>
            <Typography gutterBottom>
              Top P: {currentSettings.topP}
            </Typography>
            <Slider
              value={currentSettings.topP}
              onChange={(_, value) => handleChange('topP', value)}
              min={0}
              max={1}
              step={0.1}
              marks
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Frequency Penalty */}
          <Box>
            <Typography gutterBottom>
              Frequency Penalty: {currentSettings.frequencyPenalty}
            </Typography>
            <Slider
              value={currentSettings.frequencyPenalty}
              onChange={(_, value) => handleChange('frequencyPenalty', value)}
              min={-2}
              max={2}
              step={0.1}
              marks
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Presence Penalty */}
          <Box>
            <Typography gutterBottom>
              Presence Penalty: {currentSettings.presencePenalty}
            </Typography>
            <Slider
              value={currentSettings.presencePenalty}
              onChange={(_, value) => handleChange('presencePenalty', value)}
              min={-2}
              max={2}
              step={0.1}
              marks
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Stop Sequences */}
          <Box>
            <Typography gutterBottom>Stop Sequences</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                value={newStopSequence}
                onChange={(e) => setNewStopSequence(e.target.value)}
                placeholder="Add stop sequence"
                size="small"
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleAddStopSequence}
                disabled={!newStopSequence.trim()}
              >
                Add
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {currentSettings.stopSequences.map((sequence, index) => (
                <Chip
                  key={index}
                  label={sequence}
                  onDelete={() => handleRemoveStopSequence(sequence)}
                />
              ))}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChatSettingsDialog; 