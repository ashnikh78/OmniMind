from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    # Required Core Settings
    LOG_LEVEL: Literal['debug', 'info', 'warning', 'error', 'critical'] = 'info'
    PROJECT_NAME: str = "OmniMind"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: Literal["development", "production"] = "development"
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    
    # Redis Configuration
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_TIMEOUT: int = 5
    REDIS_POOL_SIZE: int = 10
    
    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/omnimind"
    
    # JWT Configuration
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Simple singleton pattern
_settings_instance = None

def get_settings() -> Settings:
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
    return _settings_instance