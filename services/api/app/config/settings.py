from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    # Redis Configuration
    REDIS_URL: str = "redis://redis:6379/0"
    
    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/omnimind"
    
    # JWT Configuration
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # ML Service Configuration
    ML_SERVICE_URL: str = "http://ollama:11434"
    MODEL_UNLOAD_TIMEOUT: int = 300
    
    # Metrics Configuration
    PROMETHEUS_MULTIPROC_DIR: str = "/tmp/prometheus"
    METRICS_URL: str = "http://prometheus:9090"
    
    # Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "noreply@omnimind.example.com"
    SMTP_PASSWORD: str = "<gmail-app-password>"
    EMAIL_FROM: str = "noreply@omnimind.example.com"
    
    # Environment Configuration
    NODE_ENV: str = "development"
    LOG_LEVEL: str = "info"
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "OmniMind"
    ENVIRONMENT: str = "development"
    
    # Frontend Configuration
    REACT_APP_API_URL: str = "https://app.apiplatform.ai"
    REACT_APP_METRICS_URL: str = "http://prometheus:9090"
    
    
    class Config:
        env_file = ".env"
        extra = "allow"  # This allows extra environment variables without raising errors

@lru_cache()
def get_settings() -> Settings:
    return Settings()