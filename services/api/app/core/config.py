from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database settings
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/omnimind"
    
    # Redis settings
    REDIS_URL: str = "redis://redis:6379/0"
    
    # JWT settings
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Ollama settings
    OLLAMA_HOST: str = "http://localhost:11434"
    MODEL_UNLOAD_TIMEOUT: int = 300  # 5 minutes
    
    class Config:
        env_file = ".env"

# Create settings instance
settings = Settings() 