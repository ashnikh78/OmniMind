from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List, Dict
import logging
import os

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "OmniMind AI"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    SECRET_KEY: str = Field(..., env="SECRET_KEY")  # Require SECRET_KEY from env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REDIS_URL: str = Field(default="redis://:redis@redis:6379/0", env="REDIS_URL")
    DATABASE_URL: str = Field(default="postgresql://postgres:postgres@db:5432/om NIMIND", env="DATABASE_URL")
    ML_SERVICE_URL: str = Field(default="http://ollama:11434", env="ML_SERVICE_URL")
    OLLAMA_HOST: str = Field(default="http://ollama:11434", env="OLLAMA_HOST")
    METRICS_URL: str = Field(default="http://localhost:9090", env="REACT_APP_METRICS_URL")
    SMTP_HOST: str = Field(default="smtp.gmail.com", env="SMTP_HOST")
    SMTP_PORT: int = Field(default=587, env="SMTP_PORT")
    SMTP_USER: str = Field(default="noreply@omnimind.example.com", env="SMTP_USER")
    SMTP_PASSWORD: str = Field(..., env="SMTP_PASSWORD")  # Require in production
    EMAIL_FROM: str = Field(default="noreply@omnimind.example.com", env="EMAIL_FROM")
    BACKEND_CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:80,http://frontend:80,http://localhost:3000").split(",")
    )
    SECURITY_HEADERS: Dict[str, str] = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'; connect-src 'self' ws://localhost:* wss://app.apiplatform.ai http://localhost:* http://api:8000 http://ollama:11434; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        safe_redis_url = self.REDIS_URL.replace(':redis@', ':****@') if ':redis@' in self.REDIS_URL else self.REDIS_URL
        logger.info(f"Initialized settings: ENVIRONMENT={self.ENVIRONMENT}, REDIS_URL={safe_redis_url}, DATABASE_URL={self.DATABASE_URL}")

settings = Settings()