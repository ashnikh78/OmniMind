from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "OmniMind AI"
    SECRET_KEY: str = Field(default="KXWq4ECxVJwFNUfdzpKXOUOavqB_s-Cg0Q7mX03AO0v7bYjmsDv-92l8vbVZxC_j59N_1Af1gL8")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REDIS_URL: str = Field(default="redis://:redis@redis:6379/0")
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:80",
        "http://localhost:3000",
        "http://frontend:80",
        "https://app.apiplatform.ai"
    ]
    OLLAMA_HOST: str = Field(default="http://ollama:11434")

    SECURITY_HEADERS: Dict[str, str] = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'; connect-src 'self' ws://localhost:* http://localhost:* http://ollama:11434 http://api:8000; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }
    TRANSFORMER_EMOTION_MODEL: str = "distilbert-base-uncased-finetuned-sst-2-english"
    TRANSFORMER_ATTENTION_HEADS: int = 12
    TRANSFORMER_HIDDEN_SIZE: int = 768
    TRANSFORMER_DROPOUT: float = 0.1
    TRANSFORMER_LEARNING_RATE: float = 0.0001

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        logger.info(f"Initialized settings: REDIS_URL={self.REDIS_URL}, OLLAMA_HOST={self.OLLAMA_HOST}, SECRET_KEY={self.SECRET_KEY[:10]}...")

settings = Settings()