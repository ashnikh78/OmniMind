# OmniMind - Advanced AI Chatbot Platform

## Overview
OmniMind is an enterprise-grade AI chatbot platform with advanced monitoring, logging, and observability features.

## Features
- Advanced AI/ML capabilities
- Persona management system
- Real-time monitoring with Grafana
- Metrics collection with Prometheus
- Distributed logging with Loki
- Container orchestration with Docker Compose

## Prerequisites
- Docker and Docker Compose
- Node.js 16+ (for local development)
- PostgreSQL 14+
- Redis 7+

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/OmniMind.git
cd OmniMind
```

2. Create a `.env` file with the following variables:
```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=omnimind

# Redis
REDIS_PASSWORD=your_secure_redis_password_here

# Grafana
GRAFANA_PASSWORD=your_secure_grafana_password_here

# API
API_KEY=your_secure_api_key_here
API_SECRET=your_secure_api_secret_here

# Monitoring
PROMETHEUS_MULTIPROC_DIR=/tmp
```

3. Start the services:
```bash
docker-compose up -d
```

4. Access the services:
- Frontend: http://localhost:80
- API: http://localhost:8000
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090

## Monitoring & Observability

### Grafana Dashboards
The platform includes pre-configured Grafana dashboards for:
- API performance metrics
- System resource usage
- Error rates and latency
- User engagement metrics

### Prometheus Metrics
Key metrics collected:
- HTTP request duration
- Request rates
- Error rates
- Memory usage
- CPU utilization

### Logging
- Distributed logging with Loki
- Log aggregation with Promtail
- Structured logging format

## Development

### Local Development
1. Install dependencies:
```bash
cd services/frontend
npm install
cd ../api
npm install
```

2. Start development servers:
```bash
# Frontend
cd services/frontend
npm run dev

# API
cd services/api
npm run dev
```

### Testing
```bash
# Frontend tests
cd services/frontend
npm test

# API tests
cd services/api
npm test
```

## Security
- All services run in isolated Docker networks
- Secure password handling with environment variables
- Rate limiting and request validation
- CORS configuration
- API key authentication

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License
MIT License - see LICENSE file for details
