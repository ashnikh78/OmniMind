from pydantic_settings import BaseSettings
from typing import Optional
import secrets

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "OmniMind AI"
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    #DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/omnimind"
    DATABASE_URL: str = "postgresql://admin:admin@db:5432/omnimind"
    # Redis
    REDIS_URL: str = "redis://:redis@localhost:6380/0"
    REDIS_PASSWORD: str = "redis"
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost", "http://localhost:80"]
    
    # Ollama
    OLLAMA_HOST: str = "http://ollama:11434"
    
    # Security Headers
    SECURITY_HEADERS: dict = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings() 