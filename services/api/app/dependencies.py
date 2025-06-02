from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
import jwt
import json
from typing import Any, Dict

# settings and redis_client will be accessed via request.app.state
# oauth2_scheme will also be accessed via request.app.state or imported from a central spot in main

# Note: The OAuth2PasswordBearer instance should be created once and shared.
# It will be initialized in main.py and stored in app.state.oauth2_scheme.

async def get_redis_client(request: Request) -> Any:
    if hasattr(request.app.state, "redis_client"):
        return request.app.state.redis_client
    # Fallback for testing or if not run through full app, though this should ideally not be hit in prod
    if hasattr(request.app, "redis_client_manual_testing"): # For potential direct test setup
        return request.app.redis_client_manual_testing
    raise RuntimeError("Redis client not available in app state. Ensure it's initialized and set in main.py's app.state.redis_client.")

async def get_settings(request: Request) -> Any:
    if hasattr(request.app.state, "settings"):
        return request.app.state.settings
    raise RuntimeError("Settings not available in app state.")

async def get_oauth2_scheme(request: Request) -> OAuth2PasswordBearer:
    if hasattr(request.app.state, "oauth2_scheme"):
        return request.app.state.oauth2_scheme
    raise RuntimeError("OAuth2 scheme not available in app state.")


async def get_current_user(
    request: Request, # Added request to access app.state
    token: str = Depends(lambda r: r.app.state.oauth2_scheme if hasattr(r.app.state, "oauth2_scheme") else OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login_placeholder_for_Depends_init")), # Access oauth2_scheme from app.state
    redis: Any = Depends(get_redis_client)
) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    current_settings = await get_settings(request)

    try:
        payload = jwt.decode(token, current_settings.SECRET_KEY, algorithms=[current_settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        
        user_data_json = redis.get(f"user:{user_id}")
        if not user_data_json:
            raise credentials_exception
        user_data = json.loads(user_data_json)
        # Add user_id to the returned dict as it's often useful
        user_data['id'] = user_id 
        return user_data
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError:
        raise credentials_exception
    except redis.RedisError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to user database",
        )

async def get_current_active_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    # Add any checks for active status if needed, e.g., current_user.get("disabled")
    return current_user