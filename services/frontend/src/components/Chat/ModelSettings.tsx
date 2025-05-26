import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Slider,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
} from '@mui/material';
import { Model } from '../../services/aiService';
import { ModelSettings as ModelSettingsType } from '../../types/model';

export interface ModelSettingsProps {
  open: boolean;
  onClose: () => void;
  currentModel: string;
  onModelChange: (settings: ModelSettingsType) => void;
  availableModels: Model[];
  onModelSelect: (modelId: string) => void;
}

const defaultSettings: ModelSettingsType = {
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  topK: 40,
  presencePenalty: 0,
  frequencyPenalty: 0,
  stopSequences: [],
  contextWindow: 4000,
  streaming: true,
  systemPrompt: 'You are a helpful AI assistant.',
};

const ModelSettings: React.FC<ModelSettingsProps> = ({
  open,
  onClose,
  currentModel,
  onModelChange,
  availableModels,
  onModelSelect,
}) => {
  const [settings, setSettings] = useState<ModelSettingsType>(defaultSettings);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSettingChange = (key: keyof ModelSettingsType, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onModelChange(newSettings);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Model Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Model</InputLabel>
            <Select
              value={currentModel}
              onChange={(e) => onModelSelect(e.target.value)}
              label="Model"
            >
              {availableModels.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography gutterBottom>Temperature</Typography>
          <Slider
            value={settings.temperature}
            onChange={(_, value) => handleSettingChange('temperature', value)}
            min={0}
            max={2}
            step={0.1}
            marks={[
              { value: 0, label: '0' },
              { value: 1, label: '1' },
              { value: 2, label: '2' },
            ]}
          />
          <Typography variant="caption" color="text.secondary">
            Controls randomness: 0 is deterministic, 2 is more creative
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography gutterBottom>Max Tokens</Typography>
          <Slider
            value={settings.maxTokens}
            onChange={(_, value) => handleSettingChange('maxTokens', value)}
            min={1}
            max={4000}
            step={1}
            marks={[
              { value: 1, label: '1' },
              { value: 2000, label: '2000' },
              { value: 4000, label: '4000' },
            ]}
          />
          <Typography variant="caption" color="text.secondary">
            Maximum number of tokens to generate
          </Typography>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
            />
          }
          label="Show Advanced Settings"
        />

        {showAdvanced && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>Top P</Typography>
              <Slider
                value={settings.topP}
                onChange={(_, value) => handleSettingChange('topP', value)}
                min={0}
                max={1}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' },
                ]}
              />
              <Typography variant="caption" color="text.secondary">
                Controls diversity via nucleus sampling
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>Top K</Typography>
              <Slider
                value={settings.topK}
                onChange={(_, value) => handleSettingChange('topK', value)}
                min={1}
                max={100}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 50, label: '50' },
                  { value: 100, label: '100' },
                ]}
              />
              <Typography variant="caption" color="text.secondary">
                Controls diversity via top-k sampling
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>Presence Penalty</Typography>
              <Slider
                value={settings.presencePenalty}
                onChange={(_, value) => handleSettingChange('presencePenalty', value)}
                min={-2}
                max={2}
                step={0.1}
                marks={[
                  { value: -2, label: '-2' },
                  { value: 0, label: '0' },
                  { value: 2, label: '2' },
                ]}
              />
              <Typography variant="caption" color="text.secondary">
                Penalizes repeated tokens
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>Frequency Penalty</Typography>
              <Slider
                value={settings.frequencyPenalty}
                onChange={(_, value) => handleSettingChange('frequencyPenalty', value)}
                min={-2}
                max={2}
                step={0.1}
                marks={[
                  { value: -2, label: '-2' },
                  { value: 0, label: '0' },
                  { value: 2, label: '2' },
                ]}
              />
              <Typography variant="caption" color="text.secondary">
                Penalizes repeated token frequencies
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>Stop Sequences</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                {settings.stopSequences.map((seq, index) => (
                  <Chip
                    key={index}
                    label={seq}
                    onDelete={() => {
                      const newSequences = settings.stopSequences.filter(
                        (_, i) => i !== index
                      );
                      handleSettingChange('stopSequences', newSequences);
                    }}
                  />
                ))}
              </Stack>
              <TextField
                fullWidth
                size="small"
                placeholder="Add stop sequence"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    const value = input.value.trim();
                    if (value) {
                      handleSettingChange('stopSequences', [
                        ...settings.stopSequences,
                        value,
                      ]);
                      input.value = '';
                    }
                  }
                }}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>Context Window</Typography>
              <Slider
                value={settings.contextWindow}
                onChange={(_, value) => handleSettingChange('contextWindow', value)}
                min={1}
                max={8000}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 4000, label: '4000' },
                  { value: 8000, label: '8000' },
                ]}
              />
              <Typography variant="caption" color="text.secondary">
                Maximum number of tokens in the context window
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.streaming}
                    onChange={(e) =>
                      handleSettingChange('streaming', e.target.checked)
                    }
                  />
                }
                label="Enable Streaming"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Stream responses as they are generated
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>System Prompt</Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={settings.systemPrompt}
                onChange={(e) =>
                  handleSettingChange('systemPrompt', e.target.value)
                }
                placeholder="Enter system prompt..."
              />
              <Typography variant="caption" color="text.secondary">
                Instructions for the model's behavior
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onClose} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModelSettings; 