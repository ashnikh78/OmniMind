# app/dependencies/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core import get_settings
from app.schemas.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user = User(**payload)
        return user
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )