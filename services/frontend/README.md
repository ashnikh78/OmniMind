# OmniMind Frontend

This is the frontend application for OmniMind, a real-time chat and messaging platform.

## Features

- Real-time chat functionality
- Direct messaging between users
- User authentication
- Responsive design
- Modern UI with Material-UI components

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws
```

3. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App

## Project Structure

```
src/
  ├── components/     # Reusable components
  ├── contexts/       # React contexts
  ├── pages/         # Page components
  ├── services/      # API and WebSocket services
  ├── App.js         # Main app component
  └── index.js       # Entry point
```

## Development

### Adding New Features

1. Create new components in the `components` directory
2. Add new pages in the `pages` directory
3. Update routing in `App.js`
4. Add new API endpoints in `services/api.js`

### Styling

The project uses Material-UI for styling. Custom styles can be added using the `sx` prop or by creating custom styled components.

### State Management

- Authentication state is managed using React Context (`AuthContext`)
- WebSocket connections are managed by the `WebSocketManager` class
- Local component state is managed using React hooks

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## License

This project is licensed under the MIT License. 