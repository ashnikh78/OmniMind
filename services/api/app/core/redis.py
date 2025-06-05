import redis
import logging
from typing import Optional
from app.core.config import get_settings

logger = logging.getLogger(__name__)

def init_redis_client() -> Optional[redis.Redis]:
    """Initialize and return a Redis client with proper settings"""
    settings = get_settings()
    try:
        client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            health_check_interval=30
        )
        if client.ping():
            logger.info(f"Connected to Redis at {settings.REDIS_URL}")
            return client
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
    return None

async def close_redis_client(client: redis.Redis):
    """Properly close Redis connection"""
    try:
        client.close()
        logger.info("Redis connection closed")
    except Exception as e:
        logger.error(f"Error closing Redis: {e}")