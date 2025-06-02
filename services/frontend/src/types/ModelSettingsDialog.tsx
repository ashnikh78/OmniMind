import React from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, Button, Stack } from '@mui/material';
import { ModelSettings } from '../types/model';

interface ModelSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: ModelSettings;
  onSave: (newSettings: ModelSettings) => void;
}

const ModelSettingsDialog: React.FC<ModelSettingsProps> = ({ open, onClose, settings, onSave }) => {
  const [tempSettings, setTempSettings] = React.useState<ModelSettings>(settings);

  const handleChange = (key: keyof ModelSettings, value: number) => {
    setTempSettings({ ...tempSettings, [key]: value });
  };

  const handleSave = () => {
    onSave(tempSettings);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Model Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={2}>
          <TextField
            label="Temperature"
            type="number"
            inputProps={{ step: 0.1, min: 0, max: 1 }}
            value={tempSettings.temperature}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
          />
          <TextField
            label="Max Tokens"
            type="number"
            value={tempSettings.maxTokens}
            onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
          />
          <TextField
            label="Top P"
            type="number"
            inputProps={{ step: 0.1, min: 0, max: 1 }}
            value={tempSettings.topP}
            onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
          />
          <TextField
            label="Frequency Penalty"
            type="number"
            value={tempSettings.frequencyPenalty}
            onChange={(e) => handleChange('frequencyPenalty', parseFloat(e.target.value))}
          />
          <TextField
            label="Presence Penalty"
            type="number"
            value={tempSettings.presencePenalty}
            onChange={(e) => handleChange('presencePenalty', parseFloat(e.target.value))}
          />
          <Button onClick={handleSave} variant="contained">Save</Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default ModelSettingsDialog;
