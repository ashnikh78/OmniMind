#!/bin/sh
if [ -z "$REDIS_PASSWORD" ]; then
  echo "ERROR: REDIS_PASSWORD is not set"
  exit 1
fi

echo "Starting Redis with password protection..."
exec redis-server --requirepass "$REDIS_PASSWORD"
