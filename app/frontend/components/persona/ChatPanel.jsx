import React, { useState } from 'react';
import { IconButton } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import PersonaSelector from './PersonaSelector';

interface Persona {
  id: string;
  name: string;
  avatar: string;
  prompt: string;
  description?: string;
}

interface Message {
  id: string;
  content: string;
  persona: Persona;
  timestamp: Date;
}

interface ChatPanelProps {
  onSend: (message: Message) => void;
}

const personas: Persona[] = [
  { id: 'default', name: 'Helpful Assistant', avatar: '🤖', prompt: 'You are a helpful AI assistant.' },
  { id: 'coder', name: 'Code Expert', avatar: '💻', prompt: 'You are an expert programmer.', description: 'Specialized in coding solutions' },
];

const ChatPanel: React.FC<ChatPanelProps> = ({ onSend }) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona>(personas[0]);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSend = () => {
    if (!message.trim()) return;
    const newMessage: Message = {
      id: crypto.randomUUID(),
      content: message,
      persona: selectedPersona,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    onSend(newMessage);
    setMessage('');
  };

  return (
    <div className="flex flex-col h-full p-4 bg-gray-100 rounded-lg shadow-md">
      <PersonaSelector
        personas={personas}
        selectedPersona={selectedPersona}
        onSelect={setSelectedPersona}
      />
      <div className="flex-1 overflow-y-auto mb-4 p-4 bg-white rounded-lg">
        {messages.map((msg) => (
          <div key={msg.id} className="mb-4">
            <div className="flex items-center">
              <span className="text-lg mr-2">{msg.persona.avatar}</span>
              <span className="font-semibold">{msg.persona.name}</span>
              <span className="text-sm text-gray-500 ml-2">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-1 text-gray-800">{msg.content}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          aria-label="Chat input"
        />
        <IconButton
          onClick={handleSend}
          disabled={!message.trim()}
          aria-label="Send message"
          className="bg-blue-500 text-white hover:bg-blue-600"
        >
          <SendIcon />
        </IconButton>
      </div>
    </div>
  );
};

export default ChatPanel;