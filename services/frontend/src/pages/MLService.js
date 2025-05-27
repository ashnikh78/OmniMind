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
  ListItemAvatar,
  Avatar,
  Chip,
  ListItemIcon,
  Collapse,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  Storage as StorageIcon,
  Code as CodeIcon,
  BugReport as BugReportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Send as SendIcon,
  Person as PersonIcon,
  Chat as ChatIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useMLService } from '../contexts/MLServiceContext';
import { useAuth } from '../contexts/AuthContext';
import { api, mlServiceAPI } from '../services/api';
import { toast } from 'react-toastify';

// Debug flag - set to true to enable detailed logging
const DEBUG = true;

const debugLog = (...args) => {
  if (DEBUG) {
    console.log('[MLService]', ...args);
  }
};

function MLService() {
  const {
    models,
    activeModel,
    loading,
    error,
    inferenceResults,
    modelMetrics,
    isProcessing,
    setIsProcessing,
    setActiveModel,
    runInference,
    getModelMetrics,
    updateModelSettings,
    trainModel,
    deployModel,
    refreshModels,
    debugInfo,
    pullModel,
    deleteModel,
  } = useMLService();
  const { user } = useAuth();

  const [input, setInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [trainingData, setTrainingData] = useState('');
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelCapabilities, setModelCapabilities] = useState([]);
  const [selectedCapability, setSelectedCapability] = useState(null);
  const [modelParameters, setModelParameters] = useState({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
  });
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [isPullingModel, setIsPullingModel] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    customization: true,
    cloning: false,
    translation: false,
    adaptation: true,
    synthesis: true,
    modulation: true,
    preservation: true,
  });
  const [emotionSettings, setEmotionSettings] = useState({
    realTime: true,
    history: true,
    trends: true,
    prediction: true,
    correlation: true,
    context: true,
    learning: true,
  });

  const personas = [
    {
      id: 'data_scientist',
      name: 'Data Scientist',
      description: 'Expert in data analysis, machine learning, and statistical modeling',
      avatar: '📊',
      expertise: ['Data Analysis', 'Machine Learning', 'Statistical Modeling', 'Python', 'R'],
      specialties: [
        'Predictive Analytics',
        'Natural Language Processing',
        'Computer Vision',
        'Deep Learning',
        'Big Data Processing'
      ],
      credentials: ['PhD in Computer Science', 'Data Science Certification', 'ML Engineer'],
      communicationStyle: 'Analytical and precise, focusing on data-driven insights',
      keyTopics: [
        'Machine Learning',
        'Data Analysis',
        'Statistical Modeling',
        'AI Development',
        'Data Visualization'
      ],
      tools: ['Jupyter Notebook', 'TensorFlow', 'PyTorch', 'Scikit-learn']
    },
    {
      id: 'ai_researcher',
      name: 'AI Researcher',
      description: 'Specialist in artificial intelligence research and development',
      avatar: '🧠',
      expertise: ['AI Research', 'Neural Networks', 'Deep Learning', 'Reinforcement Learning'],
      specialties: [
        'Neural Architecture',
        'Model Optimization',
        'AI Ethics',
        'Research Methodology',
        'Paper Review'
      ],
      credentials: ['PhD in AI', 'Research Publications', 'Conference Speaker'],
      communicationStyle: 'Academic and thorough, focusing on research methodology',
      keyTopics: [
        'AI Research',
        'Neural Networks',
        'Deep Learning',
        'AI Ethics',
        'Research Methods'
      ],
      tools: ['Research Tools', 'Model Development', 'Paper Analysis']
    },
    {
      id: 'ml_engineer',
      name: 'ML Engineer',
      description: 'Expert in machine learning system design and implementation',
      avatar: '⚙️',
      expertise: ['ML Systems', 'Model Deployment', 'MLOps', 'System Architecture'],
      specialties: [
        'Model Deployment',
        'MLOps',
        'System Design',
        'Performance Optimization',
        'Scalability'
      ],
      credentials: ['ML Engineer Certification', 'Cloud Architecture', 'System Design'],
      communicationStyle: 'Technical and practical, focusing on implementation',
      keyTopics: [
        'ML Systems',
        'Model Deployment',
        'MLOps',
        'System Architecture',
        'Performance'
      ],
      tools: ['MLOps Tools', 'Deployment Platform', 'Monitoring System']
    },
    {
      id: 'nlp_specialist',
      name: 'NLP Specialist',
      description: 'Expert in natural language processing and text analysis',
      avatar: '📝',
      expertise: ['NLP', 'Text Mining', 'Language Models', 'Text Classification'],
      specialties: [
        'Language Models',
        'Text Classification',
        'Sentiment Analysis',
        'Text Generation',
        'Language Understanding'
      ],
      credentials: ['NLP Certification', 'Research Experience', 'Industry Projects'],
      communicationStyle: 'Linguistic and analytical, focusing on language understanding',
      keyTopics: [
        'NLP',
        'Language Models',
        'Text Analysis',
        'Sentiment Analysis',
        'Text Generation'
      ],
      tools: ['NLP Libraries', 'Language Models', 'Text Analysis Tools']
    },
    {
      id: 'computer_vision_expert',
      name: 'Computer Vision Expert',
      description: 'Specialist in computer vision and image processing',
      avatar: '👁️',
      expertise: ['Computer Vision', 'Image Processing', 'Object Detection', 'Image Classification'],
      specialties: [
        'Object Detection',
        'Image Classification',
        'Video Analysis',
        '3D Vision',
        'Image Generation'
      ],
      credentials: ['Computer Vision Certification', 'Research Experience', 'Industry Projects'],
      communicationStyle: 'Visual and technical, focusing on image understanding',
      keyTopics: [
        'Computer Vision',
        'Image Processing',
        'Object Detection',
        'Video Analysis',
        '3D Vision'
      ],
      tools: ['Vision Libraries', 'Image Processing Tools', 'Model Development']
    }
  ];

  // Add SpeechRecognition polyfill
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const initialize = async () => {
    try {
      setIsInitializing(true);
      if (!user) {
        setLocalError('Please log in to access the ML Service');
        return;
      }
      
      // Fetch available models
      await refreshModels();
      
      if (activeModel) {
        const metrics = await getModelMetrics(activeModel.id);
        if (!metrics) {
          debugLog('No metrics available for model:', activeModel.id);
        }
      }
    } catch (err) {
      debugLog('Initialization error:', err);
      setLocalError('Failed to initialize ML Service');
      toast.error('Failed to initialize ML Service');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initialize();
  }, [user, refreshModels, getModelMetrics]);

  const handleModelChange = (event) => {
    debugLog('Model changed:', event.target.value);
    const model = models.find((m) => m.id === event.target.value);
    setActiveModel(model);
    setLocalError(null);
  };

  const handleRunInference = async () => {
    if (!input.trim()) {
      toast.warning('Please enter input for inference');
      return;
    }
    try {
      debugLog('Running inference with input:', input);
      setLocalError(null);
      await runInference(input);
      toast.success('Inference completed successfully');
    } catch (err) {
      debugLog('Inference error:', err);
      setLocalError('Failed to run inference');
      toast.error('Failed to run inference');
    }
  };

  const handleStreamInference = async () => {
    if (!input.trim() || !activeModel) return;

    try {
      setIsStreaming(true);
      setStreamingResponse('');
      setLocalError(null);

      await mlServiceAPI.streamResponse({
        model: activeModel.id,
        prompt: input,
        parameters: modelParameters,
      }, 
      (chunk) => {
        setStreamingResponse(prev => prev + chunk);
      },
      (response) => {
        setIsStreaming(false);
        toast.success('Streaming completed');
      },
      (error) => {
        console.error('Streaming error:', error);
        setLocalError('Streaming failed');
        setIsStreaming(false);
        toast.error('Streaming failed');
      });
    } catch (err) {
      console.error('Streaming error:', err);
      setLocalError('Failed to start streaming');
      setIsStreaming(false);
      toast.error('Failed to start streaming');
    }
  };

  const handleParameterChange = (param, value) => {
    setModelParameters(prev => ({
      ...prev,
      [param]: value,
    }));
  };

  const handleSettingsOpen = (model) => {
    debugLog('Opening settings for model:', model);
    setSelectedModel(model);
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    debugLog('Closing settings dialog');
    setSettingsOpen(false);
    setSelectedModel(null);
  };

  const handleTrainingOpen = (model) => {
    debugLog('Opening training dialog for model:', model);
    setSelectedModel(model);
    setTrainingDialogOpen(true);
  };

  const handleTrainingClose = () => {
    debugLog('Closing training dialog');
    setTrainingDialogOpen(false);
    setSelectedModel(null);
    setTrainingData('');
  };

  const handleTrainModel = async () => {
    if (!trainingData.trim()) {
      toast.warning('Please enter training data');
      return;
    }
    try {
      debugLog('Training model with data length:', trainingData.length);
      setLocalError(null);
      await trainModel(selectedModel.id, trainingData);
      toast.success('Model training started');
      handleTrainingClose();
    } catch (err) {
      debugLog('Training error:', err);
      setLocalError('Failed to train model');
      toast.error('Failed to train model');
    }
  };

  const handleDeployModel = async (modelId) => {
    try {
      debugLog('Deploying model:', modelId);
      setLocalError(null);
      await deployModel(modelId);
      toast.success('Model deployment started');
    } catch (err) {
      debugLog('Deployment error:', err);
      setLocalError('Failed to deploy model');
      toast.error('Failed to deploy model');
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleVoiceChat = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsRecording(true);
        setIsProcessingVoice(true);
        
        // Process audio stream
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1);
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        processor.onaudioprocess = async (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert audio to text using Web Speech API
          if (!SpeechRecognition) {
            toast.error('Speech recognition is not supported in your browser');
            return;
          }

          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          
          recognition.onresult = async (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            if (event.results[event.results.length - 1].isFinal) {
              setChatInput(transcript);
              
              // Process voice with advanced features
              const formData = new FormData();
              const audioBlob = new Blob([inputData], { type: 'audio/wav' });
              formData.append('audio', audioBlob);
              formData.append('settings', JSON.stringify({
                voice: voiceSettings,
                emotion: emotionSettings,
                persona: selectedPersona ? {
                  id: selectedPersona.id,
                  name: selectedPersona.name,
                  expertise: selectedPersona.expertise,
                  specialties: selectedPersona.specialties,
                  communicationStyle: selectedPersona.communicationStyle,
                } : null,
              }));

              try {
                const response = await api.post('/api/voice-chat/', formData, {
                  headers: {
                    'Content-Type': 'multipart/form-data',
                  },
                });

                // Add user message with voice metadata
                const userMessage = {
                  role: 'user',
                  content: transcript,
                  timestamp: new Date().toISOString(),
                  metadata: {
                    model: activeModel.name,
                    persona: selectedPersona?.name,
                    voice: {
                      sentiment: response.data.sentiment,
                      emotion: response.data.emotion,
                    },
                  },
                };
                setChatHistory(prev => [...prev, userMessage]);

                // Add assistant response with voice
                const assistantMessage = {
                  role: 'assistant',
                  content: response.data.bot_text,
                  timestamp: new Date().toISOString(),
                  metadata: {
                    model: activeModel.name,
                    persona: selectedPersona?.name,
                    voice: {
                      audio: response.data.bot_audio_path,
                      sentiment: response.data.sentiment,
                    },
                  },
                };
                setChatHistory(prev => [...prev, assistantMessage]);

                // Play audio response
                const audio = new Audio(response.data.bot_audio_path);
                audio.play();
              } catch (error) {
                console.error('Error processing voice:', error);
                toast.error('Failed to process voice input');
              }
            }
          };
          
          recognition.start();
        };
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error('Could not access microphone');
      }
    } else {
      setIsRecording(false);
      setIsProcessingVoice(false);
    }
  };

  const handleSendMessage = async (message = chatInput) => {
    if (!message.trim() || !activeModel) return;

    try {
      setIsProcessing(true);
      const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        metadata: {
          model: activeModel.name,
          persona: selectedPersona?.name,
          expertise: selectedPersona?.expertise,
          specialties: selectedPersona?.specialties,
        },
      };
      setChatHistory(prev => [...prev, userMessage]);
      setChatInput('');

      // Show typing indicator
      const typingMessage = {
        role: 'assistant',
        content: '...',
        timestamp: new Date().toISOString(),
        isTyping: true,
      };
      setChatHistory(prev => [...prev, typingMessage]);

      // Prepare system prompt based on persona
      const systemPrompt = selectedPersona ? `You are ${selectedPersona.name}, ${selectedPersona.description}. 
        Your expertise includes: ${selectedPersona.expertise.join(', ')}. 
        Your specialties are: ${selectedPersona.specialties.join(', ')}. 
        Your communication style is: ${selectedPersona.communicationStyle}. 
        Focus on topics related to: ${selectedPersona.keyTopics.join(', ')}. 
        Use tools like: ${selectedPersona.tools.join(', ')}.` : '';

      const response = await api.post('/api/ollama/chat', {
        model: activeModel.id,
        content: message,
        settings: {
          temperature: modelParameters.temperature,
          maxTokens: modelParameters.maxTokens,
          topP: modelParameters.topP,
          frequencyPenalty: modelParameters.frequencyPenalty,
          presencePenalty: modelParameters.presencePenalty,
          systemPrompt: systemPrompt,
        },
        persona: selectedPersona ? {
          id: selectedPersona.id,
          name: selectedPersona.name,
          expertise: selectedPersona.expertise,
          specialties: selectedPersona.specialties,
          communicationStyle: selectedPersona.communicationStyle,
          keyTopics: selectedPersona.keyTopics,
          tools: selectedPersona.tools,
        } : null,
      });

      // Remove typing indicator
      setChatHistory(prev => prev.filter(msg => !msg.isTyping));

      const assistantMessage = {
        role: 'assistant',
        content: response.data.content,
        timestamp: new Date().toISOString(),
        metadata: {
          model: activeModel.name,
          tokens: response.data.tokens || 0,
          latency: response.data.latency || 0,
          persona: selectedPersona?.name,
          expertise: selectedPersona?.expertise,
          specialties: selectedPersona?.specialties,
          communicationStyle: selectedPersona?.communicationStyle,
        },
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Remove typing indicator if there's an error
      setChatHistory(prev => prev.filter(msg => !msg.isTyping));
    } finally {
      setIsProcessing(false);
    }
  };

  // Add chat history management
  const clearChatHistory = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      setChatHistory([]);
    }
  };

  const exportChatHistory = () => {
    const chatData = {
      model: activeModel?.name,
      persona: selectedPersona?.name,
      timestamp: new Date().toISOString(),
      messages: chatHistory,
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Add chat input enhancements
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Add persona-specific suggestions
  const getPersonaSuggestions = () => {
    if (!selectedPersona) return [];
    return [
      `Tell me about your expertise in ${selectedPersona.expertise[0]}`,
      `How do you approach ${selectedPersona.specialties[0]}?`,
      `What tools do you use for ${selectedPersona.keyTopics[0]}?`,
      `Can you explain your experience with ${selectedPersona.expertise[1]}?`,
    ];
  };

  const handleModelDialogOpen = () => {
    setModelDialogOpen(true);
  };

  const handleModelDialogClose = () => {
    setModelDialogOpen(false);
    setNewModelName('');
  };

  const handlePullModel = async () => {
    if (!newModelName.trim()) {
      toast.warning('Please enter a model name');
      return;
    }

    try {
      setIsPullingModel(true);
      await pullModel(newModelName);
      handleModelDialogClose();
    } catch (err) {
      console.error('Error pulling model:', err);
    } finally {
      setIsPullingModel(false);
    }
  };

  const handleDeleteModel = async (modelId) => {
    if (!window.confirm(`Are you sure you want to delete model ${modelId}?`)) {
      return;
    }

    try {
      await deleteModel(modelId);
    } catch (err) {
      console.error('Error deleting model:', err);
    }
  };

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Please log in to access the ML Service
        </Alert>
      </Box>
    );
  }

  if (loading || isInitializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Select Model</InputLabel>
              <Select
                value={activeModel?.id || ''}
                onChange={handleModelChange}
                label="Select Model"
                disabled={loading}
              >
                {models.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              onClick={refreshModels}
              disabled={loading}
              startIcon={<RefreshIcon />}
            >
              Refresh Models
            </Button>
          </Grid>
          {loading && (
            <Grid item>
              <CircularProgress size={24} />
            </Grid>
          )}
        </Grid>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Chat" icon={<ChatIcon />} iconPosition="start" />
        <Tab label="Inference" icon={<PlayIcon />} iconPosition="start" />
        <Tab label="Metrics" icon={<AssessmentIcon />} iconPosition="start" />
        <Tab label="Settings" icon={<SettingsIcon />} iconPosition="start" />
        <Tab label="Voice" icon={<MicIcon />} iconPosition="start" />
        <Tab label="Training" icon={<MemoryIcon />} iconPosition="start" />
        <Tab label="Deployment" icon={<StorageIcon />} iconPosition="start" />
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader 
                title="AI Personas" 
                subheader="Select a specialized AI persona to interact with"
              />
              <CardContent>
                <List>
                  {personas.map((persona) => (
                    <ListItem
                      key={persona.id}
                      button
                      selected={selectedPersona?.id === persona.id}
                      onClick={() => setSelectedPersona(persona)}
                      sx={{
                        mb: 1,
                        borderRadius: 1,
                        '&.Mui-selected': {
                          backgroundColor: 'primary.light',
                          '&:hover': {
                            backgroundColor: 'primary.light',
                          },
                        },
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: selectedPersona?.id === persona.id ? 'primary.main' : 'grey.300' }}>
                          {persona.avatar}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={persona.name}
                        secondary={
                          <>
                            <Typography variant="body2" component="span" color="text.primary">
                              {persona.description}
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              {persona.expertise.slice(0, 3).map((skill, index) => (
                                <Chip
                                  key={index}
                                  label={skill}
                                  size="small"
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                />
                              ))}
                            </Box>
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardHeader 
                title={selectedPersona ? `Chat with ${selectedPersona.name}` : 'Chat'} 
                subheader={
                  selectedPersona ? (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {selectedPersona.description}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Expertise: {selectedPersona.expertise.join(', ')}
                        </Typography>
                      </Box>
                    </Box>
                  ) : 'Select a persona to start chatting'
                }
                action={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Clear Chat">
                      <IconButton onClick={clearChatHistory} size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Export Chat">
                      <IconButton onClick={exportChatHistory} size="small">
                        <CodeIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />
              <CardContent sx={{ flexGrow: 1, overflow: 'auto', maxHeight: 400 }}>
                {selectedPersona && chatHistory.length === 0 && (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Suggested Questions
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                      {getPersonaSuggestions().map((suggestion, index) => (
                        <Chip
                          key={index}
                          label={suggestion}
                          onClick={() => setChatInput(suggestion)}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                <List>
                  {chatHistory.map((message, index) => (
                    <ListItem 
                      key={index} 
                      alignItems="flex-start"
                      sx={{
                        backgroundColor: message.role === 'assistant' ? 'action.hover' : 'transparent',
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar>
                          {message.role === 'user' ? '👤' : selectedPersona?.avatar || '🤖'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="body1" component="span">
                              {message.content}
                            </Typography>
                            {message.isTyping && (
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                <CircularProgress size={16} sx={{ mr: 1 }} />
                                <Typography variant="caption" color="text.secondary">
                                  {selectedPersona?.name || 'AI'} is typing...
                                </Typography>
                              </Box>
                            )}
                            {message.metadata?.voice?.audio && (
                              <Box sx={{ mt: 1 }}>
                                <audio controls src={message.metadata.voice.audio} />
                              </Box>
                            )}
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                              {new Date(message.timestamp).toLocaleString()}
                            </Typography>
                            {message.metadata && (
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Model: {message.metadata.model}
                                  {message.metadata.persona && ` | Persona: ${message.metadata.persona}`}
                                  {message.metadata.tokens > 0 && ` | Tokens: ${message.metadata.tokens}`}
                                  {message.metadata.latency > 0 && ` | Latency: ${message.metadata.latency.toFixed(2)}ms`}
                                  {message.metadata.voice?.sentiment && ` | Sentiment: ${message.metadata.voice.sentiment}`}
                                </Typography>
                              </Box>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Grid container spacing={2}>
                  <Grid item xs>
                    <TextField
                      fullWidth
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={`Chat with ${selectedPersona?.name || 'AI'}...`}
                      disabled={isProcessing || !activeModel}
                      onKeyPress={handleKeyPress}
                      multiline
                      maxRows={4}
                      InputProps={{
                        endAdornment: isProcessing && (
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item>
                    <Tooltip title={isRecording ? "Stop Recording" : "Start Voice Chat"}>
                      <IconButton
                        color={isRecording ? "error" : "primary"}
                        onClick={handleVoiceChat}
                        disabled={isProcessing || !activeModel}
                      >
                        {isRecording ? <MicOffIcon /> : <MicIcon />}
                      </IconButton>
                    </Tooltip>
                  </Grid>
                  <Grid item>
                    <Button
                      variant="contained"
                      endIcon={<SendIcon />}
                      onClick={() => handleSendMessage()}
                      disabled={!chatInput.trim() || isProcessing || !activeModel}
                    >
                      Send
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
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
                  disabled={isProcessing || !activeModel}
                />
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Temperature"
                      value={modelParameters.temperature}
                      onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Max Tokens"
                      value={modelParameters.maxTokens}
                      onChange={(e) => handleParameterChange('maxTokens', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 4096 }}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={isProcessing ? <StopIcon /> : <PlayIcon />}
                    onClick={handleRunInference}
                    disabled={isProcessing || !input.trim() || !activeModel}
                  >
                    {isProcessing ? 'Processing...' : 'Run Inference'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={isStreaming ? <StopIcon /> : <PlayIcon />}
                    onClick={handleStreamInference}
                    disabled={isStreaming || !input.trim() || !activeModel}
                  >
                    {isStreaming ? 'Streaming...' : 'Stream Response'}
                  </Button>
                </Box>
                {(isProcessing || isStreaming) && (
                  <LinearProgress sx={{ mt: 2 }} />
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardHeader title="Inference Results" />
              <CardContent>
                {streamingResponse && (
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Streaming Response:
                    </Typography>
                    <Typography>{streamingResponse}</Typography>
                  </Box>
                )}
                {inferenceResults.length > 0 ? (
                  <List>
                    {inferenceResults.map((result, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemText
                            primary={result.output}
                            secondary={
                              <>
                                <Typography variant="caption" display="block">
                                  {new Date(result.timestamp).toLocaleString()}
                                </Typography>
                                {result.metadata && (
                                  <Typography variant="caption" color="textSecondary">
                                    Model: {result.metadata.model} | 
                                    Tokens: {result.metadata.tokens} | 
                                    Latency: {result.metadata.latency.toFixed(2)}ms
                                  </Typography>
                                )}
                              </>
                            }
                          />
                        </ListItem>
                        {index < inferenceResults.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Typography color="textSecondary" align="center">
                    No inference results yet
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Model Information"
                action={
                  <Tooltip title="Settings">
                    <IconButton 
                      onClick={() => handleSettingsOpen(activeModel)}
                      disabled={!activeModel || isProcessing}
                    >
                      <SettingsIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
              <CardContent>
                {activeModel ? (
                  <>
                    <Typography variant="h6">{activeModel.name}</Typography>
                    <Typography color="textSecondary" gutterBottom>
                      Type: {activeModel.type}
                    </Typography>
                    <Typography color="textSecondary" gutterBottom>
                      Status: {activeModel.status}
                    </Typography>
                    {activeModel.capabilities && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Capabilities:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {activeModel.capabilities.map((capability) => (
                            <Chip
                              key={capability}
                              label={capability}
                              color={selectedCapability === capability ? 'primary' : 'default'}
                              onClick={() => setSelectedCapability(capability)}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Metrics:
                      </Typography>
                      {modelMetrics ? (
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              Accuracy: {(modelMetrics.performance?.accuracy * 100).toFixed(1)}%
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              Latency: {modelMetrics.performance?.latency.toFixed(2)}ms
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              Throughput: {modelMetrics.performance?.throughput} req/s
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              Error Rate: {(modelMetrics.performance?.error_rate * 100).toFixed(1)}%
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="body2" color="textSecondary">
                              Usage: {modelMetrics.usage?.requests} requests
                            </Typography>
                          </Grid>
                        </Grid>
                      ) : (
                        <Typography color="textSecondary">Loading metrics...</Typography>
                      )}
                    </Box>
                  </>
                ) : (
                  <Typography color="textSecondary">No model selected</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Model Settings" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Temperature"
                      value={modelParameters.temperature}
                      onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Max Tokens"
                      value={modelParameters.maxTokens}
                      onChange={(e) => handleParameterChange('maxTokens', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 4096 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Top P"
                      value={modelParameters.topP}
                      onChange={(e) => handleParameterChange('topP', parseFloat(e.target.value))}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Top K"
                      value={modelParameters.topK || 40}
                      onChange={(e) => handleParameterChange('topK', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 100 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Frequency Penalty"
                      value={modelParameters.frequencyPenalty}
                      onChange={(e) => handleParameterChange('frequencyPenalty', parseFloat(e.target.value))}
                      inputProps={{ min: -2, max: 2, step: 0.1 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Presence Penalty"
                      value={modelParameters.presencePenalty}
                      onChange={(e) => handleParameterChange('presencePenalty', parseFloat(e.target.value))}
                      inputProps={{ min: -2, max: 2, step: 0.1 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Model Quantization</InputLabel>
                      <Select
                        value={modelParameters.quantization || 'none'}
                        onChange={(e) => handleParameterChange('quantization', e.target.value)}
                        label="Model Quantization"
                      >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="q4_0">Q4_0</MenuItem>
                        <MenuItem value="q4_1">Q4_1</MenuItem>
                        <MenuItem value="q5_0">Q5_0</MenuItem>
                        <MenuItem value="q5_1">Q5_1</MenuItem>
                        <MenuItem value="q8_0">Q8_0</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="GPU Layers"
                      value={modelParameters.numGpuLayers || 0}
                      onChange={(e) => handleParameterChange('numGpuLayers', parseInt(e.target.value))}
                      inputProps={{ min: 0, max: 100 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="CPU Threads"
                      value={modelParameters.numThreads || 4}
                      onChange={(e) => handleParameterChange('numThreads', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 32 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Batch Size"
                      value={modelParameters.batchSize || 512}
                      onChange={(e) => handleParameterChange('batchSize', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 512 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>RoPE Scaling</InputLabel>
                      <Select
                        value={modelParameters.ropeScaling || 'none'}
                        onChange={(e) => handleParameterChange('ropeScaling', e.target.value)}
                        label="RoPE Scaling"
                      >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="linear">Linear</MenuItem>
                        <MenuItem value="dynamic">Dynamic</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="System Prompt"
                      value={modelParameters.systemPrompt || ''}
                      onChange={(e) => handleParameterChange('systemPrompt', e.target.value)}
                      placeholder="Enter system prompt..."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Stop Sequences"
                      value={modelParameters.stopSequences?.join(', ') || ''}
                      onChange={(e) => handleParameterChange('stopSequences', e.target.value.split(',').map(s => s.trim()))}
                      placeholder="Enter stop sequences separated by commas..."
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Advanced Learning Settings" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Learning Mode</InputLabel>
                      <Select
                        value={modelParameters.learningMode || 'off'}
                        onChange={(e) => handleParameterChange('learningMode', e.target.value)}
                        label="Learning Mode"
                      >
                        <MenuItem value="off">Off</MenuItem>
                        <MenuItem value="passive">Passive Learning</MenuItem>
                        <MenuItem value="active">Active Learning</MenuItem>
                        <MenuItem value="reinforced">Reinforced Learning</MenuItem>
                        <MenuItem value="supervised">Supervised Learning</MenuItem>
                        <MenuItem value="unsupervised">Unsupervised Learning</MenuItem>
                        <MenuItem value="transfer">Transfer Learning</MenuItem>
                        <MenuItem value="federated">Federated Learning</MenuItem>
                        <MenuItem value="meta">Meta Learning</MenuItem>
                        <MenuItem value="continual">Continual Learning</MenuItem>
                        <MenuItem value="curriculum">Curriculum Learning</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Learning Rate"
                      value={modelParameters.learningRate || 0.0001}
                      onChange={(e) => handleParameterChange('learningRate', parseFloat(e.target.value))}
                      inputProps={{ min: 0.00001, max: 0.1, step: 0.00001 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Epochs"
                      value={modelParameters.epochs || 3}
                      onChange={(e) => handleParameterChange('epochs', parseInt(e.target.value))}
                      inputProps={{ min: 1, max: 100 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Optimization Strategy</InputLabel>
                      <Select
                        value={modelParameters.optimization || 'adam'}
                        onChange={(e) => handleParameterChange('optimization', e.target.value)}
                        label="Optimization Strategy"
                      >
                        <MenuItem value="adam">Adam</MenuItem>
                        <MenuItem value="sgd">SGD</MenuItem>
                        <MenuItem value="rmsprop">RMSprop</MenuItem>
                        <MenuItem value="adagrad">AdaGrad</MenuItem>
                        <MenuItem value="adamax">AdaMax</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleParameterChange('startLearning', true)}
                        disabled={modelParameters.learningMode === 'off'}
                      >
                        Start Learning
                      </Button>
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => handleParameterChange('pauseLearning', true)}
                        sx={{ ml: 2 }}
                        disabled={modelParameters.learningMode === 'off'}
                      >
                        Pause
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => handleParameterChange('resetLearning', true)}
                        sx={{ ml: 2 }}
                        disabled={modelParameters.learningMode === 'off'}
                      >
                        Reset
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Voice Settings" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      Voice Processing
                    </Typography>
                    <FormControl component="fieldset">
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={voiceSettings.customization}
                                onChange={(e) => setVoiceSettings(prev => ({
                                  ...prev,
                                  customization: e.target.checked
                                }))}
                              />
                            }
                            label="Voice Customization"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={voiceSettings.cloning}
                                onChange={(e) => setVoiceSettings(prev => ({
                                  ...prev,
                                  cloning: e.target.checked
                                }))}
                              />
                            }
                            label="Voice Cloning"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={voiceSettings.translation}
                                onChange={(e) => setVoiceSettings(prev => ({
                                  ...prev,
                                  translation: e.target.checked
                                }))}
                              />
                            }
                            label="Voice Translation"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={voiceSettings.adaptation}
                                onChange={(e) => setVoiceSettings(prev => ({
                                  ...prev,
                                  adaptation: e.target.checked
                                }))}
                              />
                            }
                            label="Voice Adaptation"
                          />
                        </Grid>
                      </Grid>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      Emotion Analysis
                    </Typography>
                    <FormControl component="fieldset">
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={emotionSettings.realTime}
                                onChange={(e) => setEmotionSettings(prev => ({
                                  ...prev,
                                  realTime: e.target.checked
                                }))}
                              />
                            }
                            label="Real-time Analysis"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={emotionSettings.history}
                                onChange={(e) => setEmotionSettings(prev => ({
                                  ...prev,
                                  history: e.target.checked
                                }))}
                              />
                            }
                            label="Emotion History"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={emotionSettings.trends}
                                onChange={(e) => setEmotionSettings(prev => ({
                                  ...prev,
                                  trends: e.target.checked
                                }))}
                              />
                            }
                            label="Emotion Trends"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={emotionSettings.prediction}
                                onChange={(e) => setEmotionSettings(prev => ({
                                  ...prev,
                                  prediction: e.target.checked
                                }))}
                              />
                            }
                            label="Emotion Prediction"
                          />
                        </Grid>
                      </Grid>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Voice Chat History" />
              <CardContent>
                <List>
                  {chatHistory
                    .filter(msg => msg.metadata?.voice)
                    .map((message, index) => (
                      <ListItem key={index}>
                        <ListItemAvatar>
                          <Avatar>
                            {message.role === 'user' ? '👤' : selectedPersona?.avatar || '🤖'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={message.content}
                          secondary={
                            <>
                              <Typography variant="caption" display="block">
                                {new Date(message.timestamp).toLocaleString()}
                              </Typography>
                              {message.metadata.voice.sentiment && (
                                <Typography variant="caption" color="text.secondary">
                                  Sentiment: {message.metadata.voice.sentiment}
                                </Typography>
                              )}
                            </>
                          }
                        />
                        {message.metadata.voice.audio && (
                          <ListItemSecondaryAction>
                            <audio controls src={message.metadata.voice.audio} />
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                    ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 5 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Model Training" />
              <CardContent>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  value={trainingData}
                  onChange={(e) => setTrainingData(e.target.value)}
                  placeholder="Enter training data..."
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  onClick={handleTrainModel}
                  disabled={!trainingData.trim() || !selectedModel}
                >
                  Train Model
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Training History" />
              <CardContent>
                <List>
                  {models.map((model) => (
                    <ListItem key={model.id}>
                      <ListItemAvatar>
                        <Avatar>
                          {model.type === 'llama' ? '🦙' : model.type === 'mistral' ? '🌪️' : '🤖'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={model.name}
                        secondary={
                          <>
                            <Typography variant="body2" component="span">
                              Type: {model.type}
                            </Typography>
                            <br />
                            <Typography variant="body2" component="span">
                              Status: {model.status}
                            </Typography>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleTrainingOpen(model)}
                        >
                          Train
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 6 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Model Deployment" />
              <CardContent>
                <List>
                  {models.map((model) => (
                    <ListItem key={model.id}>
                      <ListItemAvatar>
                        <Avatar>
                          {model.type === 'llama' ? '🦙' : model.type === 'mistral' ? '🌪️' : '🤖'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={model.name}
                        secondary={
                          <>
                            <Typography variant="body2" component="span">
                              Type: {model.type}
                            </Typography>
                            <br />
                            <Typography variant="body2" component="span">
                              Status: {model.status}
                            </Typography>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleDeployModel(model.id)}
                          disabled={model.status === 'deployed'}
                        >
                          {model.status === 'deployed' ? 'Deployed' : 'Deploy'}
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Deployment Status" />
              <CardContent>
                <List>
                  {models
                    .filter(model => model.status === 'deployed')
                    .map((model) => (
                      <ListItem key={model.id}>
                        <ListItemAvatar>
                          <Avatar>
                            {model.type === 'llama' ? '🦙' : model.type === 'mistral' ? '🌪️' : '🤖'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={model.name}
                          secondary={
                            <>
                              <Typography variant="body2" component="span">
                                Deployed: {new Date(model.deployedAt).toLocaleString()}
                              </Typography>
                              <br />
                              <Typography variant="body2" component="span">
                                Endpoint: {model.endpoint}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                    ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={handleSettingsClose} maxWidth="sm" fullWidth>
        <DialogTitle>Model Settings</DialogTitle>
        <DialogContent>
          {selectedModel && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Current Settings
              </Typography>
              <List>
                {Object.entries(selectedModel.parameters || {}).map(([key, value]) => (
                  <ListItem key={key}>
                    <ListItemText
                      primary={key}
                      secondary={typeof value === 'object' ? JSON.stringify(value) : value}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={modelDialogOpen} onClose={handleModelDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Model</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Model Name"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="e.g., llama2, mistral, codellama"
              disabled={isPullingModel}
              helperText="Enter the name of the model to pull from Ollama"
            />
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Popular Models:
              </Typography>
              <Grid container spacing={1}>
                {[
                  { name: 'llama2', description: 'Meta\'s Llama 2 model', size: '7B' },
                  { name: 'mistral', description: 'Mistral AI\'s model', size: '7B' },
                  { name: 'codellama', description: 'Code-specific Llama model', size: '13B' },
                  { name: 'tinyllama', description: 'Lightweight Llama model', size: '1.1B' },
                  { name: 'neural-chat', description: 'Chat-optimized model', size: '7B' },
                  { name: 'starling-lm', description: 'Starling LM model', size: '7B' }
                ].map((model) => (
                  <Grid item xs={12} sm={6} key={model.name}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => setNewModelName(model.name)}
                    >
                      <CardContent>
                        <Typography variant="subtitle1">{model.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {model.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Size: {model.size}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleModelDialogClose} disabled={isPullingModel}>
            Cancel
          </Button>
          <Button
            onClick={handlePullModel}
            variant="contained"
            disabled={!newModelName.trim() || isPullingModel}
            startIcon={isPullingModel ? <CircularProgress size={20} /> : null}
          >
            {isPullingModel ? 'Pulling Model...' : 'Pull Model'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Model List Dialog */}
      <Dialog open={showDebug} onClose={() => setShowDebug(false)} maxWidth="md" fullWidth>
        <DialogTitle>Installed Models</DialogTitle>
        <DialogContent>
          <List>
            {models.map((model) => (
              <ListItem
                key={model.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteModel(model.id)}
                    disabled={isProcessing}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemAvatar>
                  <Avatar>
                    {model.type === 'llama' ? '🦙' : model.type === 'mistral' ? '🌪️' : '🤖'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={model.name}
                  secondary={
                    <>
                      <Typography variant="body2" component="span">
                        Type: {model.type}
                      </Typography>
                      <br />
                      <Typography variant="body2" component="span">
                        Capabilities: {model.capabilities.join(', ')}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDebug(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MLService; 