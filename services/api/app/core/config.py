from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Redis Configuration
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_TIMEOUT: int = 5  # seconds
    REDIS_POOL_SIZE: int = 10
    
    # Add all other existing settings...
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/omnimind"
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    OLLAMA_HOST: str = "http://localhost:11434"
    MODEL_UNLOAD_TIMEOUT: int = 300
    LOG_LEVEL: str = "info"
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    ENVIRONMENT: str = "development"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()