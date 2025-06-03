import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Slider,
  Box,
  Typography,
} from '@mui/material';
import { ModelSettings } from '@/types/model';

interface ModelSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: ModelSettings;
  onSave: React.Dispatch<React.SetStateAction<ModelSettings>>;
}

const ModelSettingsDialog: React.FC<ModelSettingsProps> = ({ open, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<ModelSettings>(settings);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Model Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography gutterBottom>Temperature: {localSettings.temperature}</Typography>
          <Slider
            value={localSettings.temperature}
            onChange={(e, value) =>
              setLocalSettings({ ...localSettings, temperature: value as number })
            }
            min={0}
            max={1}
            step={0.1}
          />
        </Box>
        <Box sx={{ mt: 2 }}>
          <Typography gutterBottom>Max Tokens: {localSettings.maxTokens}</Typography>
          <Slider
            value={localSettings.maxTokens}
            onChange={(e, value) =>
              setLocalSettings({ ...localSettings, maxTokens: value as number })
            }
            min={100}
            max={4000}
            step={100}
          />
        </Box>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="System Prompt"
            value={localSettings.systemPrompt}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, systemPrompt: e.target.value })
            }
            multiline
            rows={3}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModelSettingsDialog;