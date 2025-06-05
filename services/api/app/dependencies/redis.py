# app/dependencies/redis.py
from fastapi import Depends
from app.core.redis import get_redis_pool

async def get_redis_client():
    return await get_redis_pool()