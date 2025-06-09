import aioredis
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

async def init_redis_client():
    """Initialize and return an async Redis client using aioredis."""
    try:
        redis_client = await aioredis.create_redis_pool(
            settings.REDIS_URL,
            decode_responses=True,
            timeout=5,
            connection_timeout=5
        )
        await redis_client.ping()
        logger.info("Async Redis connection established")
        return redis_client
    except aioredis.RedisError as e:
        logger.critical(f"Failed to initialize async Redis client: {e}")
        raise

async def close_redis_client(redis_client):
    """Close the async Redis connection."""
    try:
        if redis_client:
            redis_client.close()
            await redis_client.wait_closed()
            logger.info("Async Redis connection closed")
    except Exception as e:
        logger.error(f"Failed to close async Redis client: {e}")
