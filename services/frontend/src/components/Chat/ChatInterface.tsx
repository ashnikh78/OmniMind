// services/frontend/src/components/Chat/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  AppBar,
  Paper,
  Typography,
  CircularProgress,
  Tooltip,
  useTheme,
  useMediaQuery,
  Chip,
  Toolbar,
  IconButton,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  SentimentSatisfied as SentimentIcon,
  Category as IntentIcon,
  Label as EntityIcon,
} from '@mui/icons-material';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ModelSettings } from '@/types/model';
import ModelSettingsDialog from '@/components/Chat/ModelSettingsDialog';
import ConversationHistory from '@/components/Chat/ConversationHistory';
import ChatAnalytics from '@/components/Chat/ChatAnalytics';
import MessageInput from '@/components/Chat/MessageInput';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    sentiment?: string;
    intent?: string;
    entities?: string[];
  };
};

type Conversation = {
  id: string;
  messages: Message[];
};

(marked as any).use({
  highlight: (code: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  langPrefix: 'hljs language-',
});

const wsUrl = (process.env.REACT_APP_API_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws')
  .concat('/ws/chat');

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState<Message | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const assistantMessage: Message = {
      id: `${Date.now() + 1}`,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
    };
    setCurrentAssistantMessage(assistantMessage);

    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            content,
            model: 'default',
            settings: modelSettings,
          })
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'token') {
          setCurrentAssistantMessage((prev) =>
            prev
              ? {
                  ...prev,
                  content: prev.content + data.token,
                  timestamp: new Date(),
                }
              : null
          );
        } else if (data.type === 'final') {
          const finalMessage: Message = {
            id: data.id,
            role: 'assistant',
            content: data.content,
            timestamp: new Date(),
            metadata: data.metadata || {},
          };
          setMessages((prev) => {
            const updatedMessages = [...prev, finalMessage];
            setConversations((prevConvs) => [
              ...prevConvs,
              { id: Date.now().toString(), messages: [userMessage, finalMessage] },
            ]);
            return updatedMessages;
          });
          setCurrentAssistantMessage(null);
          setIsLoading(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        toast.error('WebSocket connection error');
        setIsLoading(false);
        setCurrentAssistantMessage(null);
      };
    } catch (error) {
      toast.error('Failed to send message');
      setIsLoading(false);
      setCurrentAssistantMessage(null);
    }
  };

  const handleTemplateSelect = (template: string) => {
    toast.info(`Selected template: ${template}`);
    // Add logic to handle template selection
  };

  const handleAIAssist = () => {
    toast.info('AI Assist triggered');
    // Add logic for AI assistance
  };

  const handleSelectConversation = (conversationId: string) => {
    const conversation = conversations.find((conv) => conv.id === conversationId);
    if (conversation) {
      setMessages(conversation.messages);
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));
  };

  const handleUpdateConversation = (conversationId: string, updated: Conversation) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === conversationId ? updated : conv))
    );
  };

  const handleShareConversation = (conversationId: string) => {
    toast.info(`Shared conversation ${conversationId}`);
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
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
            backgroundColor: isUser ? theme.palette.primary.light : theme.palette.background.paper,
            color: isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
          }}
        >
          <Typography
            component="div"
            sx={{
              '& pre': {
                backgroundColor: theme.palette.grey[900],
                color: theme.palette.grey[100],
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
              {message.metadata.sentiment && (
                <Tooltip title="Sentiment Score">
                  <Chip
                    icon={<SentimentIcon />}
                    label={message.metadata.sentiment}
                    size="small"
                    color={
                      parseFloat(message.metadata.sentiment) > 0.5
                        ? 'success'
                        : 'error'
                    }
                  />
                </Tooltip>
              )}
              {message.metadata.intent && (
                <Tooltip title="Detected Intent">
                  <Chip
                    icon={<IntentIcon />}
                    label={message.metadata.intent}
                    size="small"
                    color="primary"
                  />
                </Tooltip>
              )}
              {message.metadata.entities?.map((entity, index) => (
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
        <Typography variant="caption" color={theme.palette.text.secondary} sx={{ mt: 0.5 }}>
          {message.timestamp.toLocaleTimeString()}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Chat Assistant
          </Typography>
          <IconButton color="inherit" onClick={() => setShowAnalytics(true)}>
            <AnalyticsIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => setShowHistory(true)}>
            <HistoryIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => setShowSettings(true)}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {messages.map(renderMessage)}
        {currentAssistantMessage && renderMessage(currentAssistantMessage)}
        {isLoading && (
          <CircularProgress sx={{ display: 'block', mx: 'auto', my: 2 }} />
        )}
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

      <ModelSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={modelSettings}
        onSave={setModelSettings}
      />

      <ConversationHistory
        open={showHistory}
        onClose={() => setShowHistory(false)}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onUpdateConversation={handleUpdateConversation}
        onShareConversation={handleShareConversation}
      />

      <ChatAnalytics messages={messages} />

      <ToastContainer />
    </Box>
  );
};

export default ChatInterface;