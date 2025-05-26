import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import ChatAnalytics from '../ChatAnalytics';
import { aiService } from '../../../services/aiService';

// Mock the AI service
jest.mock('../../../services/aiService');

const mockTheme = createTheme();

const mockAnalytics = {
  messageCount: 100,
  averageResponseTime: 1.5,
  sentimentTrends: [
    { timestamp: '2024-01-01', positive: 0.7, negative: 0.2, neutral: 0.1 },
    { timestamp: '2024-01-02', positive: 0.8, negative: 0.1, neutral: 0.1 }
  ],
  intentDistribution: [
    { type: 'question', count: 50 },
    { type: 'command', count: 30 },
    { type: 'statement', count: 20 }
  ],
  entityFrequency: [
    { type: 'topic', value: 'AI', count: 40 },
    { type: 'person', value: 'User', count: 30 },
    { type: 'technology', value: 'ML', count: 20 }
  ],
  tokenUsage: {
    total: 5000,
    average: 50,
    byModel: {
      'model1': 3000,
      'model2': 2000
    }
  }
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('ChatAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (aiService.getAnalytics as jest.Mock).mockResolvedValue(mockAnalytics);
  });

  it('renders loading state initially', () => {
    renderWithTheme(<ChatAnalytics />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('loads and displays analytics data', async () => {
    renderWithTheme(<ChatAnalytics />);

    await waitFor(() => {
      expect(aiService.getAnalytics).toHaveBeenCalled();
    });

    // Check overview cards
    expect(screen.getByText('100')).toBeInTheDocument(); // Message count
    expect(screen.getByText('1.5s')).toBeInTheDocument(); // Average response time
    expect(screen.getByText('5000')).toBeInTheDocument(); // Total tokens

    // Check sentiment trends
    expect(screen.getByText('Sentiment Trends')).toBeInTheDocument();
    expect(screen.getByText('Positive')).toBeInTheDocument();
    expect(screen.getByText('Negative')).toBeInTheDocument();
    expect(screen.getByText('Neutral')).toBeInTheDocument();

    // Check intent distribution
    expect(screen.getByText('Intent Distribution')).toBeInTheDocument();
    expect(screen.getByText('question')).toBeInTheDocument();
    expect(screen.getByText('command')).toBeInTheDocument();
    expect(screen.getByText('statement')).toBeInTheDocument();

    // Check entity frequency
    expect(screen.getByText('Entity Frequency')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('ML')).toBeInTheDocument();
  });

  it('handles empty analytics data', async () => {
    (aiService.getAnalytics as jest.Mock).mockResolvedValue({
      messageCount: 0,
      averageResponseTime: 0,
      sentimentTrends: [],
      intentDistribution: [],
      entityFrequency: [],
      tokenUsage: {
        total: 0,
        average: 0,
        byModel: {}
      }
    });

    renderWithTheme(<ChatAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument(); // Message count
      expect(screen.getByText('0s')).toBeInTheDocument(); // Average response time
      expect(screen.getByText('0')).toBeInTheDocument(); // Total tokens
    });

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    (aiService.getAnalytics as jest.Mock).mockRejectedValue(new Error('Failed to load analytics'));

    renderWithTheme(<ChatAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics')).toBeInTheDocument();
    });
  });

  it('updates analytics data periodically', async () => {
    jest.useFakeTimers();

    renderWithTheme(<ChatAnalytics />);

    await waitFor(() => {
      expect(aiService.getAnalytics).toHaveBeenCalledTimes(1);
    });

    // Fast-forward time
    jest.advanceTimersByTime(30000); // 30 seconds

    await waitFor(() => {
      expect(aiService.getAnalytics).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('displays correct percentages in charts', async () => {
    renderWithTheme(<ChatAnalytics />);

    await waitFor(() => {
      // Check intent distribution percentages
      expect(screen.getByText('50%')).toBeInTheDocument(); // question
      expect(screen.getByText('30%')).toBeInTheDocument(); // command
      expect(screen.getByText('20%')).toBeInTheDocument(); // statement

      // Check entity frequency percentages
      expect(screen.getByText('44.4%')).toBeInTheDocument(); // AI
      expect(screen.getByText('33.3%')).toBeInTheDocument(); // User
      expect(screen.getByText('22.2%')).toBeInTheDocument(); // ML
    });
  });

  it('displays model-specific token usage', async () => {
    renderWithTheme(<ChatAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('model1')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
      expect(screen.getByText('model2')).toBeInTheDocument();
      expect(screen.getByText('2000')).toBeInTheDocument();
    });
  });
}); 