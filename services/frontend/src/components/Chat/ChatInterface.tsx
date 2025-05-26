import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useTheme,
  useMediaQuery,
  Drawer,
  Chip,
  Avatar,
  IconButton,
  AppBar,
  Toolbar
} from '@mui/material';
import {
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  ModelTraining as ModelIcon,
  SentimentSatisfied as SentimentIcon,
  Category as IntentIcon,
  Label as EntityIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { ollamaService, type ChatMessage, type OllamaModel } from '../../services/ollamaService';
import { aiService, type ConversationContext, type Entity, AIService } from '../../services/aiService';
import { toast, ToastContainer } from 'react-toastify';
import ChatAnalytics from './ChatAnalytics';
import { ModelSettings } from '../../types/model';
import ModelSettingsDialog from './ModelSettings';
import ConversationHistory from './ConversationHistory';
import MessageInput from './MessageInput';
import 'highlight.js/styles/github-dark.css';
import 'react-toastify/dist/ReactToastify.css';

// Configure marked to use highlight.js
(marked as any).use({
  highlight: (code: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  langPrefix: 'hljs language-'
});

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    sentiment?: string;
    intent?: string;
    entities?: string[];
    tokens?: number;
  };
}

interface Model {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  maxTokens: number;
  temperature: number;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  isStarred: boolean;
  tags: string[];
  folder?: string;
}

const aiServiceInstance = new AIService(
  process.env.REACT_APP_API_URL || 'http://localhost:8000',
  process.env.REACT_APP_API_KEY || ''
);

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [modelSettings, setModelSettings] = useState<ModelSettings>({
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
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadModels = async () => {
    try {
      const models = await aiServiceInstance.getAvailableModels();
      setAvailableModels(models);
      if (models.length > 0) {
        setSelectedModel(models[0].id);
      }
    } catch (error) {
      toast.error('Failed to load models');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateContext = async (newMessages: Message[]) => {
    try {
      const context = await aiServiceInstance.updateContext(newMessages);
      return context;
    } catch (error) {
      toast.error('Failed to update context');
      return null;
    }
  };

  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!content.trim() && (!files || files.length === 0)) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await aiServiceInstance.sendMessage(content, selectedModel, modelSettings);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: {
          sentiment: response.sentiment,
          intent: response.intent,
          entities: response.entities,
          tokens: response.tokens,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await updateContext([...messages, userMessage, assistantMessage]);
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
  };

  const handleModelSettingsChange = (settings: ModelSettings) => {
    setModelSettings(settings);
  };

  const handleTemplateSelect = (template: string) => {
    let message = '';
    switch (template) {
      case 'greeting':
        message = 'Hello! How can I help you today?';
        break;
      case 'question':
        message = 'I have a question about...';
        break;
      case 'feedback':
        message = 'I would like to provide feedback on...';
        break;
    }
    handleSendMessage(message);
  };

  const handleAIAssist = async () => {
    if (messages.length === 0) {
      toast.info('Start a conversation to get AI assistance');
      return;
    }

    setIsLoading(true);
    try {
      const lastMessage = messages[messages.length - 1];
      const suggestions = await aiServiceInstance.generateSuggestions(lastMessage.content);
      toast.info('AI suggestions available');
      // Handle suggestions (e.g., show in a dialog)
    } catch (error) {
      toast.error('Failed to get AI suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const sentiment = message.metadata?.sentiment;
    const intent = message.metadata?.intent;
    const entities = message.metadata?.entities;

    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
        }}
      >
        <Paper
          elevation={1}
          sx={{
            p: 2,
            maxWidth: '70%',
            backgroundColor: isUser ? 'primary.light' : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
          }}
        >
          <Typography
            component="div"
            sx={{
              '& pre': {
                backgroundColor: 'grey.900',
                color: 'grey.100',
                p: 2,
                borderRadius: 1,
                overflowX: 'auto',
              },
              '& code': {
                fontFamily: 'monospace',
              },
            }}
            dangerouslySetInnerHTML={{ __html: marked(message.content) }}
          />
          {!isUser && message.metadata && (
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {sentiment !== undefined && (
                <Tooltip title="Sentiment Score">
                  <Chip
                    icon={<SentimentIcon />}
                    label={sentiment}
                    size="small"
                    color={parseFloat(sentiment) > 0.5 ? 'success' : 'error'}
                  />
                </Tooltip>
              )}
              {intent && (
                <Tooltip title="Detected Intent">
                  <Chip
                    icon={<IntentIcon />}
                    label={intent}
                    size="small"
                    color="primary"
                  />
                </Tooltip>
              )}
              {entities?.map((entity, index) => (
                <Tooltip key={index} title={entity}>
                  <Chip
                    icon={<EntityIcon />}
                    label={entity}
                    size="small"
                    color="secondary"
                  />
                </Tooltip>
              ))}
            </Box>
          )}
        </Paper>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {message.timestamp.toLocaleTimeString()}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: 'background.default'
      }}
    >
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setShowHistory(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            OmniMind Chat
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Conversation History">
              <IconButton onClick={() => setShowHistory(true)}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Analytics">
              <IconButton onClick={() => setShowAnalytics(true)}>
                <AnalyticsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Model Settings">
              <IconButton onClick={() => setShowSettings(true)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </Box>

      <Box sx={{ p: 2 }}>
        <MessageInput
          onSend={handleSendMessage}
          isLoading={isLoading}
          onTemplateSelect={handleTemplateSelect}
          onAIAssist={handleAIAssist}
        />
      </Box>

      {/* Analytics Drawer */}
      <Drawer
        anchor="right"
        open={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 600
          }
        }}
      >
        <ChatAnalytics />
      </Drawer>

      {/* Model Settings Dialog */}
      <ModelSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        currentModel={selectedModel}
        onModelChange={handleModelSettingsChange}
        availableModels={availableModels}
        onModelSelect={handleModelSelect}
      />

      {/* Conversation History Drawer */}
      <ConversationHistory
        open={showHistory}
        onClose={() => setShowHistory(false)}
        conversations={[]} // TODO: Implement conversation history
        onSelectConversation={(id) => {
          // TODO: Load conversation
          setShowHistory(false);
        }}
        onDeleteConversation={(id) => {
          // TODO: Delete conversation
        }}
        onUpdateConversation={(id, updates) => {
          // TODO: Update conversation
        }}
        onShareConversation={(id) => {
          // TODO: Share conversation
        }}
      />

      <ToastContainer position="bottom-right" />
    </Box>
  );
};

export default ChatInterface; 