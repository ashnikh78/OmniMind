import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  TextField,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Tooltip,
  Fade,
  Zoom,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Send as SendIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  EmojiEmotions as EmojiIcon,
  AttachFile as AttachIcon,
  Settings as SettingsIcon,
  School as SchoolIcon,
  Work as WorkIcon,
  Star as StarIcon,
  Chat as ChatIcon,
  Topic as TopicIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import { professionalPersonas } from '../../data/professionalPersonas';
import { Persona } from '../../types/persona';
import ProfessionalTools from './ProfessionalTools';

// Styled Components
const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

interface MessageBubbleProps {
  isUser: boolean;
}

const MessageBubble = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isUser',
})<MessageBubbleProps>(({ theme, isUser }) => ({
  maxWidth: '70%',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  backgroundColor: isUser ? theme.palette.primary.main : theme.palette.grey[200],
  color: isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
  marginBottom: theme.spacing(2),
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    [isUser ? 'right' : 'left']: -10,
    width: 20,
    height: 20,
    backgroundColor: 'inherit',
    clipPath: 'polygon(0 0, 100% 100%, 0 100%)',
  },
}));

const ChatContainer = styled(Box)(({ theme }) => ({
  height: 'calc(100vh - 200px)',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

const MessageList = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(2),
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.grey[100],
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.grey[300],
    borderRadius: '4px',
  },
}));

const InputContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
}));

const PersonaGrid = styled(Grid)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(4),
}));

const PersonaCard = styled(Card)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'scale(1.02)',
    boxShadow: theme.shadows[4],
  },
}));

const PersonaAvatar = styled(Avatar)(({ theme }) => ({
  width: theme.spacing(7),
  height: theme.spacing(7),
  marginBottom: theme.spacing(2),
}));

const ThemeToggle = styled(IconButton)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const PersonaDetails = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  marginTop: theme.spacing(2),
}));

const ExpertiseList = styled(List)(({ theme }) => ({
  '& .MuiListItem-root': {
    padding: theme.spacing(1, 0),
  },
}));

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  personaId?: string;
}

const PersonaInteraction: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() && selectedPersona) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: inputValue,
        isUser: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      setInputValue('');
      // Simulate persona response
      setTimeout(() => {
        const response: Message = {
          id: (Date.now() + 1).toString(),
          content: `This is a simulated response from ${selectedPersona.name}`,
          isUser: false,
          timestamp: new Date(),
          personaId: selectedPersona.id,
        };
        setMessages((prev) => [...prev, response]);
      }, 1000);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <AnimatePresence>
        {!selectedPersona ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Typography variant="h4" component="h1" gutterBottom align="center">
              Choose Your Professional Advisor
            </Typography>
            <PersonaGrid container spacing={3}>
              {professionalPersonas.map((persona) => (
                <Grid item xs={12} sm={6} md={4} key={persona.id}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <PersonaCard onClick={() => setSelectedPersona(persona)}>
                      <CardContent>
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                          <PersonaAvatar
                            src={persona.avatar}
                            alt={persona.name}
                          />
                          <Typography variant="h6" gutterBottom>
                            {persona.name}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            paragraph
                          >
                            {persona.description}
                          </Typography>
                        </Box>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Expertise
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {persona.expertise.map((skill) => (
                              <Chip
                                key={skill}
                                label={skill}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Credentials
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {persona.credentials.map((credential) => (
                              <Chip
                                key={credential}
                                label={credential}
                                size="small"
                                color="secondary"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                      </CardContent>
                    </PersonaCard>
                  </motion.div>
                </Grid>
              ))}
            </PersonaGrid>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar src={selectedPersona.avatar} alt={selectedPersona.name} />
              <Typography variant="h6">{selectedPersona.name}</Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSelectedPersona(null)}
              >
                Change Advisor
              </Button>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <PersonaDetails>
                  <Typography variant="h6" gutterBottom>
                    Professional Profile
                  </Typography>
                  <ExpertiseList>
                    <ListItem>
                      <ListItemIcon>
                        <WorkIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Specialties"
                        secondary={selectedPersona.specialties.join(', ')}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SchoolIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Credentials"
                        secondary={selectedPersona.credentials.join(', ')}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <ChatIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Communication Style"
                        secondary={selectedPersona.communicationStyle}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <TopicIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Key Topics"
                        secondary={selectedPersona.keyTopics.join(', ')}
                      />
                    </ListItem>
                  </ExpertiseList>
                </PersonaDetails>
                {selectedPersona.tools && selectedPersona.tools.length > 0 && (
                  <ProfessionalTools persona={selectedPersona} />
                )}
              </Grid>
              <Grid item xs={12} md={8}>
                <ChatContainer>
                  <MessageList ref={messageListRef}>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: message.isUser ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <MessageBubble isUser={message.isUser}>
                            <Typography variant="body1">
                              {message.content}
                            </Typography>
                            <Typography
                              variant="caption"
                              color={message.isUser ? 'inherit' : 'text.secondary'}
                              sx={{ display: 'block', mt: 1 }}
                            >
                              {message.timestamp.toLocaleTimeString()}
                            </Typography>
                          </MessageBubble>
                        </Box>
                      </motion.div>
                    ))}
                  </MessageList>
                  <InputContainer>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      variant="outlined"
                      size="small"
                    />
                    <Tooltip title="Attach File">
                      <IconButton>
                        <AttachIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Add Emoji">
                      <IconButton>
                        <EmojiIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={isRecording ? 'Stop Recording' : 'Start Recording'}>
                      <IconButton
                        color={isRecording ? 'error' : 'primary'}
                        onClick={toggleRecording}
                      >
                        {isRecording ? <MicOffIcon /> : <MicIcon />}
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      color="primary"
                      endIcon={<SendIcon />}
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim()}
                    >
                      Send
                    </Button>
                  </InputContainer>
                </ChatContainer>
              </Grid>
            </Grid>
          </motion.div>
        )}
      </AnimatePresence>
      <ThemeToggle onClick={toggleDarkMode}>
        {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
      </ThemeToggle>
    </Container>
  );
};

export default PersonaInteraction; 