#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check service health
check_service() {
    local service=$1
    local url=$2
    local status=$(curl -s -o /dev/null -w "%{http_code}" $url)
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}[✓] $service is healthy${NC}"
        return 0
    else
        echo -e "${RED}[✗] $service is unhealthy (Status: $status)${NC}"
        return 1
    fi
}

# Check API health
echo "Checking API health..."
check_service "API" "http://localhost:8000/health"

# Check Ollama health
echo "Checking Ollama health..."
check_service "Ollama" "http://localhost:11434/api/health"

# Check Redis health
echo "Checking Redis health..."
if docker-compose exec redis redis-cli ping | grep -q "PONG"; then
    echo -e "${GREEN}[✓] Redis is healthy${NC}"
else
    echo -e "${RED}[✗] Redis is unhealthy${NC}"
fi

# Check PostgreSQL health
echo "Checking PostgreSQL health..."
if docker-compose exec postgres pg_isready -U omnimind; then
    echo -e "${GREEN}[✓] PostgreSQL is healthy${NC}"
else
    echo -e "${RED}[✗] PostgreSQL is unhealthy${NC}"
fi

# Check Prometheus health
echo "Checking Prometheus health..."
check_service "Prometheus" "http://localhost:9090/-/healthy"

# Check container status
echo -e "\nChecking container status..."
docker-compose ps

# Check resource usage
echo -e "\nChecking resource usage..."
docker stats --no-stream 