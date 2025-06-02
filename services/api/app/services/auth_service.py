import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import json
from typing import Optional, Dict, Any

# This would ideally be imported from a shared config or passed in
# For now, let's define placeholders or assume they are accessible via a settings object
# No longer using placeholders here, these will be passed or imported from main app context

# CryptContext will be passed from the main application
# Passlib context for password hashing
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str, pwd_context: CryptContext) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str, pwd_context: CryptContext) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, settings: Any, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# User operations (currently Redis-based, could be abstracted further to a UserRepository)
# For now, these functions will expect a redis_client to be passed or accessible.

def get_user_by_email(redis_client: Any, email: str) -> Optional[Dict[str, Any]]:
    user_id = redis_client.get(f"user:email:{email}")
    if not user_id:
        return None
    user_data_json = redis_client.get(f"user:{user_id}")
    if not user_data_json:
        return None
    return json.loads(user_data_json)

def get_user_by_id(redis_client: Any, user_id: str) -> Optional[Dict[str, Any]]:
    user_data_json = redis_client.get(f"user:{user_id}")
    if not user_data_json:
        return None
    return json.loads(user_data_json)

def create_db_user(redis_client: Any, user_create_data: Dict[str, Any], pwd_context: CryptContext) -> Dict[str, Any]:
    if redis_client.exists(f"user:email:{user_create_data['email']}"):
        # This check should ideally be in the router to raise HTTPException
        raise ValueError("User already exists") # Or return None/False
    
    user_id = str(redis_client.incr("user_counter"))
    hashed_password = get_password_hash(user_create_data['password'], pwd_context)
    
    db_user_data = {
        "id": user_id,
        "email": user_create_data['email'],
        "hashed_password": hashed_password, # Store hashed_password
        "role": user_create_data.get('role', 'user'),
        "created_at": datetime.utcnow().isoformat()
    }
    redis_client.set(f"user:{user_id}", json.dumps(db_user_data))
    redis_client.set(f"user:email:{db_user_data['email']}", user_id)
    
    # Return data suitable for UserResponse (without password)
    response_data = db_user_data.copy()
    del response_data["hashed_password"]
    return response_data