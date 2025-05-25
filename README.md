# OmniMind Admin Panel

A modern, feature-rich admin panel with real-time collaboration, analytics, and document management capabilities.

## Features

- **Real-time Collaboration**
  - Live document editing
  - User presence tracking
  - Chat functionality
  - File sharing

- **Analytics Dashboard**
  - System metrics
  - User activity tracking
  - Performance monitoring
  - Custom visualizations

- **Document Management**
  - Collaborative editing
  - Version history
  - Access control
  - Real-time updates

- **Security**
  - JWT authentication
  - Role-based access control
  - Rate limiting
  - Secure WebSocket connections

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.8+ (for local development)
- Redis
- PostgreSQL

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/OmniMind.git
cd OmniMind
```

2. Create environment files:
```bash
# Create .env file for frontend
cp services/frontend/.env.example services/frontend/.env

# Create .env file for API
cp services/api/.env.example services/api/.env
```

3. Start the services using Docker Compose:
```bash
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090

## Development Setup

### Frontend Development

1. Navigate to the frontend directory:
```bash
cd services/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

### API Development

1. Navigate to the API directory:
```bash
cd services/api
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the development server:
```bash
uvicorn main:app --reload --port 8000
```

## Project Structure

```
OmniMind/
├── services/
│   ├── frontend/           # React frontend application
│   │   ├── src/
│   │   │   ├── components/ # Reusable UI components
│   │   │   ├── pages/      # Page components
│   │   │   ├── contexts/   # React contexts
│   │   │   └── services/   # API and WebSocket services
│   │   └── public/         # Static assets
│   │
│   ├── api/               # FastAPI backend
│   │   ├── main.py        # Main application file
│   │   └── requirements.txt
│   │
│   └── monitoring/        # Monitoring services
│       ├── prometheus/    # Prometheus configuration
│       └── grafana/       # Grafana dashboards
│
├── docker-compose.yml     # Docker Compose configuration
└── README.md             # Project documentation
```

## Environment Variables

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws
```

### API (.env)
```
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://user:password@postgres:5432/omnimind
```

## Monitoring

The project includes monitoring with Prometheus and Grafana:

1. Access Grafana at http://localhost:3001
   - Default credentials: admin/admin
   - Pre-configured dashboards for:
     - System metrics
     - User activity
     - API performance
     - WebSocket connections

2. Access Prometheus at http://localhost:9090
   - View raw metrics
   - Test queries
   - Configure alerts

## Health Checks

Run the health check script to verify all services:
```bash
./healthcheck.ps1  # On Windows
./healthcheck.sh   # On Unix-like systems
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
