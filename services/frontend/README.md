# OmniMind Frontend

A secure and feature-rich frontend application for the OmniMind platform.

## Security Features

The application implements several security measures to protect user data and prevent common web vulnerabilities:

### Token Management
- Secure token storage with encryption
- Automatic token refresh
- Token expiration handling
- CSRF protection

### Rate Limiting
- Per-endpoint rate limiting
- Configurable time windows and request limits
- Automatic blocking of excessive requests

### IP Blocking
- Automatic IP blocking after failed attempts
- Configurable block duration
- Attempt tracking and logging

### Device Fingerprinting
- Unique device identification
- Component-based fingerprinting
- Secure hash generation

### Security Headers
- Content Security Policy (CSP)
- XSS Protection
- Frame Protection
- HSTS
- Referrer Policy
- Permissions Policy

### Input Sanitization
- HTML sanitization
- JavaScript injection prevention
- Event handler removal

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Update the environment variables in `.env`:
   - Set `REACT_APP_API_URL` to your API endpoint
   - Set `REACT_APP_WS_URL` to your WebSocket endpoint
   - Generate a secure encryption key for `REACT_APP_ENCRYPTION_KEY`
   - Set `REACT_APP_ENVIRONMENT` to 'development' or 'production'

4. Start the development server:
   ```bash
   npm start
   ```

## Development

### Available Scripts

- `npm start`: Start the development server
- `npm build`: Build the production bundle
- `npm test`: Run tests
- `npm run lint`: Run ESLint
- `npm run lint:fix`: Fix ESLint issues
- `npm run type-check`: Run TypeScript type checking

### Security Best Practices

1. Never commit sensitive data or API keys
2. Always use environment variables for configuration
3. Keep dependencies up to date
4. Follow the principle of least privilege
5. Implement proper error handling
6. Use HTTPS in production
7. Enable security headers
8. Implement proper CORS policies
9. Use secure session management
10. Regular security audits

## Testing

The application includes comprehensive tests for security features:

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Features

### Core Chat Features
- Real-time messaging with WebSocket support
- Markdown and code syntax highlighting
- File attachments and drag-and-drop support
- Voice input and recording
- Message history and context management
- Typing indicators and read receipts

### AI Capabilities
- Multiple model support (LLM, Classification, Regression, Clustering)
- Real-time sentiment analysis
- Intent detection and classification
- Entity extraction and recognition
- Context-aware responses
- Memory management for conversation history

### Advanced UI/UX
- Modern Material-UI design
- Responsive layout
- Dark/Light theme support
- Real-time message streaming
- Code block syntax highlighting
- File preview and handling
- Drag-and-drop interface

### Analytics and Insights
- Real-time conversation analytics
- Sentiment trend visualization
- Intent distribution analysis
- Entity frequency tracking
- Performance metrics
- Token usage monitoring

### Security and Performance
- Secure WebSocket connections
- Rate limiting and request throttling
- Error handling and recovery
- Session management
- Token-based authentication
- CSRF protection

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Modern web browser

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/omnimind.git
cd omnimind/services/frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory:
```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

4. Start the development server:
```bash
npm start
# or
yarn start
```

### Building for Production

```bash
npm run build
# or
yarn build
```

## Project Structure

```
src/
├── components/
│   └── Chat/
│       ├── ChatInterface.tsx    # Main chat interface
│       ├── ChatSettings.tsx     # Chat settings dialog
│       └── ChatAnalytics.tsx    # Analytics dashboard
├── services/
│   ├── apiClient.ts            # API client configuration
│   ├── chatService.ts          # Chat service implementation
│   ├── mlService.ts            # ML service implementation
│   └── websocket.ts            # WebSocket service
├── types/
│   ├── api.ts                  # API type definitions
│   └── chat.ts                 # Chat type definitions
└── utils/
    └── security.ts             # Security utilities
```

## Usage

### Basic Chat

```typescript
import { ChatInterface } from './components/Chat/ChatInterface';

function App() {
  return (
    <ChatInterface
      initialModelId="default-model"
      onSessionChange={(session) => console.log('Session:', session)}
    />
  );
}
```

### Custom Settings

```typescript
import { ChatSettings } from './types/chat';

const customSettings: ChatSettings = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: ['\n\n', 'Human:', 'AI:'],
};
```

## Acknowledgments

- Material-UI for the component library
- Recharts for data visualization
- React-Dropzone for file handling
- Highlight.js for code syntax highlighting
- Marked for Markdown parsing

# OmniMind Chat Interface

A modern, enterprise-grade chat interface for interacting with Ollama models. This implementation provides a seamless and intuitive user experience for AI-powered conversations.

## Features

- **Model Management**
  - Discover available Ollama models
  - Switch between different models
  - Pull new models from Ollama repository
  - Delete unused models

- **Chat Interface**
  - Real-time message streaming
  - Markdown support with syntax highlighting
  - Code block formatting
  - File upload and drag-and-drop support
  - Copy message content to clipboard

- **User Experience**
  - Responsive design for all screen sizes
  - Loading states and error handling
  - Toast notifications for user feedback
  - Smooth scrolling and message transitions

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Ollama server running locally

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/omnimind.git
cd omnimind/services/frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm start
# or
yarn start
```

The application will be available at `http://localhost:3000`.

## Usage

### Chat Interface

1. **Sending Messages**
   - Type your message in the input field
   - Press Enter or click the send button
   - Messages support markdown formatting

2. **File Upload**
   - Drag and drop files into the input area
   - Click the upload button to select files
   - Supported formats: text files, markdown, code files

3. **Model Management**
   - Click the model settings icon to view available models
   - Select a model to switch to it
   - Use the delete button to remove unused models

### Code Blocks

The chat interface supports code blocks with syntax highlighting:

```markdown
```javascript
const greeting = 'Hello, World!';
console.log(greeting);
```
```

## Development

### Project Structure

```
src/
  ├── components/
  │   └── Chat/
  │       ├── ChatInterface.tsx
  │       └── __tests__/
  │           └── ChatInterface.test.tsx
  ├── services/
  │   └── ollamaService.ts
  ├── types/
  │   └── chat.d.ts
  └── utils/
      └── security.ts
```

### Available Scripts

- `npm start` - Start development server
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Check TypeScript types

### Testing

The project uses Jest and React Testing Library for testing. Run tests with:

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ollama](https://github.com/ollama/ollama) for providing the AI models
- [Material-UI](https://mui.com/) for the component library
- [React Dropzone](https://react-dropzone.js.org/) for file upload functionality
- [Marked](https://marked.js.org/) for markdown parsing
- [Highlight.js](https://highlightjs.org/) for code syntax highlighting 