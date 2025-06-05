import redis
import logging
from typing import Optional
from app.core import get_settings  # Updated import path

logger = logging.getLogger(__name__)
settings = get_settings()

def init_redis_client(max_retries: int = 3, retry_delay: int = 1) -> Optional[redis.Redis]:
    """Initialize Redis client with retry logic."""
    logger.info(f"Connecting to Redis at {settings.REDIS_URL}")
    
    for attempt in range(max_retries):
        try:
            client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test the connection
            if client.ping():
                logger.info("Redis connection established")
                return client
        except redis.RedisError as e:
            logger.error(f"Redis connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                import time
                time.sleep(retry_delay)
    
    logger.error("Failed to connect to Redis after retries")
    return None


async def close_redis_client(client: redis.Redis):
    """Properly close Redis connection"""
    try:
        client.close()
        logger.info("Redis connection closed")
    except Exception as e:
        logger.error(f"Error closing Redis connection: {e}")