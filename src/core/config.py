import aioredis
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

async def init_redis_client():
    """Initialize and return a Redis client."""
    try:
        redis = await aioredis.create_redis_pool(
            settings.REDIS_URL,
            encoding="utf-8",
            max_connections=10,
            timeout=5
        )
        logger.info("Redis connection established")
        return redis
    except Exception as e:
        logger.critical(f"Failed to initialize Redis client: {e}")
        raise

async def close_redis_client(redis):
    """Close the Redis client."""
    try:
        if redis:
            redis.close()
            await redis.wait_closed()
            logger.info("Redis connection closed")
    except Exception as e:
        logger.error(f"Failed to close Redis client: {e}")