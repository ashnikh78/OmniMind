from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import Any, Dict
import redis
import logging
from app.models.user import TokenData
from app.services import auth_service
from config import settings

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_redis_client():
    try:
        client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
        )
        client.ping()
        return client
    except redis.RedisError as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise HTTPException(status_code=503, detail="Redis service unavailable")

async def get_current_active_user(token: str = Depends(oauth2_scheme), redis: Any = Depends(get_redis_client)) -> Dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenData(
            email=payload.get("email"),
            role=payload.get("role"),
            user_id=payload.get("sub")
        )
        if token_data.email is None or token_data.user_id is None:
            raise credentials_exception
        user = auth_service.get_user_by_email(redis, email=token_data.email)
        if not user:
            raise credentials_exception
        return {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "created_at": user["created_at"]
        }
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise credentials_exception