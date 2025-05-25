import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Alert,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Persona } from '../../types/persona';
import {
  Download as DownloadIcon,
  Save as SaveIcon,
  Print as PrintIcon,
  Assessment as AssessmentIcon,
  Security as SecurityIcon,
  Inventory as InventoryIcon,
  Assignment as ProjectIcon,
  Calculate as CalculateIcon,
  School as SchoolIcon,
  Nature as NatureIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import RiskAssessmentTool from '../tools/RiskAssessmentTool';
import InventoryOptimizer from '../tools/InventoryOptimizer';
import ProjectManagementTool from '../tools/ProjectManagementTool';
import PropertyCalculator from '../tools/PropertyCalculator';
import ROIAnalyzer from '../tools/ROIAnalyzer';
import LearningStyleAnalyzer from '../tools/LearningStyleAnalyzer';
import EnvironmentalImpactCalculator from '../tools/EnvironmentalImpactCalculator';

const ToolCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface ProfessionalToolsProps {
  persona: {
    tools: Tool[];
  };
}

const ProfessionalTools: React.FC<ProfessionalToolsProps> = ({ persona }) => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const renderTool = () => {
    switch (selectedTool) {
      case 'property-calculator':
        return <PropertyCalculator />;
      case 'roi-analyzer':
        return <ROIAnalyzer />;
      case 'learning-style-analyzer':
        return <LearningStyleAnalyzer />;
      case 'environmental-impact-calculator':
        return <EnvironmentalImpactCalculator />;
      case 'risk-assessment-tool':
        return <RiskAssessmentTool />;
      case 'inventory-optimizer':
        return <InventoryOptimizer />;
      case 'project-management-tool':
        return <ProjectManagementTool />;
      default:
        return null;
    }
  };

  const getToolIcon = (toolId: string) => {
    switch (toolId) {
      case 'property-calculator':
        return <CalculateIcon />;
      case 'roi-analyzer':
        return <AssessmentIcon />;
      case 'learning-style-analyzer':
        return <SchoolIcon />;
      case 'environmental-impact-calculator':
        return <NatureIcon />;
      case 'risk-assessment-tool':
        return <SecurityIcon />;
      case 'inventory-optimizer':
        return <InventoryIcon />;
      case 'project-management-tool':
        return <ProjectIcon />;
      default:
        return null;
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {persona.tools.map((tool) => (
          <Grid item xs={12} sm={6} md={4} key={tool.id}>
            <Card
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 6,
                },
              }}
              onClick={() => setSelectedTool(tool.id)}
            >
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <IconButton color="primary" size="large">
                    {getToolIcon(tool.id)}
                  </IconButton>
                  <Typography variant="h6" component="div" ml={1}>
                    {tool.name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {tool.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {selectedTool && (
        <Box mt={4}>
          <Typography variant="h5" gutterBottom>
            {persona.tools.find((tool) => tool.id === selectedTool)?.name}
          </Typography>
          {renderTool()}
        </Box>
      )}
    </Box>
  );
};

export default ProfessionalTools; 