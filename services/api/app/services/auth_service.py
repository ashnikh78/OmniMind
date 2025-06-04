import uuid
import json
import logging
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

def get_user_by_email(redis_client: Any, email: str) -> Optional[Dict]:
    """Retrieve user data by email from Redis."""
    try:
        user_data = redis_client.get(f"user:{email}")
        return user_data and json.loads(user_data)
    except (redis.RedisError, json.JSONDecodeError) as e:
        logger.error(f"Error fetching user by email {email}: {e}")
        return None

def create_db_user(redis_client: Any, user_create_data: Dict, pwd_context: CryptContext) -> Dict:
    """Create a new user in Redis."""
    try:
        user_id = str(uuid.uuid4())
        hashed_password = pwd_context.hash(user_create_data["password"])
        user_data = {
            "id": user_id,
            "email": user_create_data["email"],
            "role": user_create_data.get("role", "user"),
            "hashed_password": hashed_password,
            "created_at": datetime.utcnow().isoformat()
        }
        redis_client.set(f"user:{user_create_data['email']}", json.dumps(user_data))
        redis_client.set(f"user_id:{user_id}", json.dumps(user_data))
        return user_data
    except redis.RedisError as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=503, detail="Redis service unavailable")

def verify_password(plain_password: str, hashed_password: str, pwd_context: CryptContext) -> bool:
    """Verify a plain password against a hashed password."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Error verifying password: {e}")
        return False

def create_access_token(data: Dict, settings: Any) -> str:
    """Create a JWT access token."""
    try:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode["exp"] = expire
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    except Exception as e:
        logger.error(f"Error creating access token: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")