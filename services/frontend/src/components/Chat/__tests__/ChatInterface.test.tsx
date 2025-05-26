import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import ChatInterface from '../ChatInterface';
import { ollamaService } from '../../../services/ollamaService';
import { aiService } from '../../../services/aiService';
import { toast } from 'react-toastify';

// Mock the services
jest.mock('../../../services/ollamaService');
jest.mock('../../../services/aiService');
jest.mock('react-toastify');

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('ChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ollamaService.discoverModels as jest.Mock).mockResolvedValue([
      { name: 'model1', size: 1000000 },
      { name: 'model2', size: 2000000 }
    ]);
    (ollamaService.chat as jest.Mock).mockImplementation(async function* () {
      yield { message: { content: 'Test response' }, model: 'model1' };
    });
    (aiService.generateContext as jest.Mock).mockResolvedValue({
      sentiment: { label: 'positive', score: 0.8 },
      intent: { type: 'question', confidence: 0.9 },
      entities: [{ type: 'topic', value: 'AI', confidence: 0.95 }]
    });
    (aiService.generateResponse as jest.Mock).mockResolvedValue('AI-generated response');
  });

  it('renders the chat interface with initial state', () => {
    renderWithTheme(<ChatInterface />);
    
    expect(screen.getByText('OmniMind Chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('loads available models on mount', async () => {
    renderWithTheme(<ChatInterface />);
    
    await waitFor(() => {
      expect(ollamaService.discoverModels).toHaveBeenCalled();
    });
  });

  it('sends a message and displays the response', async () => {
    renderWithTheme(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Hello, AI!');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });
  });

  it('displays message metadata when context is available', async () => {
    renderWithTheme(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Hello, AI!');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Sentiment: positive')).toBeInTheDocument();
      expect(screen.getByText('Intent: question')).toBeInTheDocument();
      expect(screen.getByText('topic: AI')).toBeInTheDocument();
    });
  });

  it('handles model selection', async () => {
    renderWithTheme(<ChatInterface />);
    
    const modelButton = screen.getByRole('button', { name: /model settings/i });
    fireEvent.click(modelButton);

    const modelOption = screen.getByText('model1');
    fireEvent.click(modelOption);

    expect(toast.success).toHaveBeenCalledWith('Switched to model: model1');
  });

  it('handles file upload', async () => {
    renderWithTheme(<ChatInterface />);
    
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByPlaceholderText('Type your message...');

    Object.defineProperty(input, 'files', {
      value: [file]
    });

    fireEvent.drop(input);

    await waitFor(() => {
      expect(input).toHaveValue('test content');
    });
  });

  it('copies message to clipboard', async () => {
    renderWithTheme(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Hello, AI!');
    fireEvent.click(sendButton);

    await waitFor(() => {
      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);
      expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
    });
  });

  it('toggles analytics drawer', async () => {
    renderWithTheme(<ChatInterface />);
    
    const analyticsButton = screen.getByRole('button', { name: /analytics/i });
    fireEvent.click(analyticsButton);

    expect(screen.getByRole('presentation')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    (ollamaService.chat as jest.Mock).mockRejectedValue(new Error('Chat error'));
    
    renderWithTheme(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Hello, AI!');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to get response from the model');
    });
  });

  it('handles model deletion', async () => {
    renderWithTheme(<ChatInterface />);
    
    const modelButton = screen.getByRole('button', { name: /model settings/i });
    fireEvent.click(modelButton);

    const deleteButton = screen.getByRole('button', { name: /delete model1/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(ollamaService.deleteModel).toHaveBeenCalledWith('model1');
      expect(ollamaService.discoverModels).toHaveBeenCalledTimes(2);
    });
  });

  it('uses AI service for response generation when context is available', async () => {
    renderWithTheme(<ChatInterface />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input, 'Hello, AI!');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(aiService.generateResponse).toHaveBeenCalled();
      expect(screen.getByText('AI-generated response')).toBeInTheDocument();
    });
  });
}); 