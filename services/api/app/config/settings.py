from pydantic import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "FastAPI Authentication"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # or "production" for production
    
    # Security
    SECRET_KEY: str = "your-secret-key-here"  # Change this to a strong random value
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    # Security headers
    SECURITY_HEADERS: dict = {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
    }

    class Config:
        case_sensitive = True

settings = Settings()