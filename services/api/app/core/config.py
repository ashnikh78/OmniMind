from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    # Redis Configuration
    REDIS_URL: str = "redis://redis:6379/0"
    REDIS_TIMEOUT: int = 5
    REDIS_POOL_SIZE: int = 10
    
    # [Keep all your other settings as shown in previous response]
    
    class Config:
        env_file = ".env"
        extra = "allow"

# Initialize settings without decorator to avoid circular imports
_settings_instance = None

def get_settings() -> Settings:
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
    return _settings_instance