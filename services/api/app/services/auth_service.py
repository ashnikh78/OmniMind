import uuid
import logging
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from typing import Any, Dict

logger = logging.getLogger(__name__)

def get_user_by_email(redis_client: Any, email: str) -> Dict:
    try:
        user_data = redis_client.get(f"user:{email}")
        return user_data and eval(user_data)
    except Exception as e:
        logger.error(f"Error fetching user by email {email}: {str(e)}")
        return None

def create_db_user(redis_client: Any, user_create_data: Dict, pwd_context: CryptContext) -> Dict:
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
        redis_client.set(f"user:{user_create_data['email']}", str(user_data))
        redis_client.set(f"user_id:{user_id}", str(user_data))
        return user_data
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        raise

def verify_password(plain_password: str, hashed_password: str, pwd_context: CryptContext) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Error verifying password: {str(e)}")
        return False

def create_access_token(data: Dict, settings: Any) -> str:
    try:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating access token: {str(e)}")
        raise