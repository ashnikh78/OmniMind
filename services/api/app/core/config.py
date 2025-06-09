
from pydantic_settings import BaseSettings
from typing import List, Dict
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    ENVIRONMENT: str = "production"
    NODE_ENV: str = "production"
    LOG_LEVEL: str = "info"
    PROJECT_NAME: str = "OmniMind"
    API_V1_STR: str = "/api/v1"
    TZ: str = "UTC"
    HEALTHCHECK_INTERVAL: int = 30
    RESTART_POLICY_DELAY: int = 5
    RESTART_MAX_ATTEMPTS: int = 5
    LOG_MAX_SIZE: str = "10m"
    LOG_MAX_FILES: int = 3
    REDIS_URL: str = "redis://default:X2aY9zPqW7mK8jN4vL5tR3hQ2wE=@redis:6379/0"
    CELERY_BROKER_URL: str = "redis://default:X2aY9zPqW7mK8jN4vL5tR3hQ2wE=@redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://default:X2aY9zPqW7mK8jN4vL5tR3hQ2wE=@redis:6379/0"
    REDIS_LOG_LEVEL: str = "warning"
    REDIS_MAXMEMORY: str = "256mb"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "omnimind"
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/omnimind"
    SECRET_KEY: str
    SECRET_KEY_BASE64: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 1440
    ML_SERVICE_URL: str = "http://ollama:11434"
    OLLAMA_HOST: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "qwen2:0.5b-instruct-q4_0"
    MODEL_UNLOAD_TIMEOUT: int = 300
    OLLAMA_LOG_LEVEL: str = "info"
    OLLAMA_NUM_PARALLEL: int = 1
    OLLAMA_MAX_QUEUE: int = 10
    OLLAMA_KEEP_ALIVE: str = "5m"
    OLLAMA_MAX_LOADED_MODELS: int = 1
    PROMETHEUS_MULTIPROC_DIR: str = "/tmp/prometheus"
    METRICS_URL: str = "http://prometheus:9090"
    REACT_APP_METRICS_URL: str = "http://prometheus:9090"
    PROMETHEUS_PORT: int = 9090
    METRICS_LOG_LEVEL: str = "info"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "noreply@omnimind.example.com"
    SMTP_PASSWORD: str
    EMAIL_FROM: str = "noreply@omnimind.example.com"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    EMAIL_TIMEOUT: int = 10
    BACKEND_CORS_ORIGINS: List[str] = ["https://app.apiplatform.ai", "http://localhost:3000"]
    SECURITY_HEADERS: Dict[str, str] = {
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://prometheus:9090",
        "X-Content-Type-Options": "nosniff",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }
    REACT_APP_API_URL: str = "http://api:8000"

    class Config:
        @classmethod
        def customise_sources(cls, init_settings, env_settings, file_secret_settings):
            env_path = Path(".env")
            if env_path.exists():
                logger.info(f".env file found at {env_path.absolute()}")
            else:
                logger.warning(f".env file not found at {env_path.absolute()}")
            return (init_settings, env_settings, file_secret_settings)

        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"

def get_settings() -> Settings:
    """Get settings with comprehensive error handling."""
    try:
        settings = Settings()
        logger.info(
            f"Settings loaded. Environment: {settings.ENVIRONMENT}\n"
            f"CORS origins: {settings.BACKEND_CORS_ORIGINS}\n"
            f"Security headers: {list(settings.SECURITY_HEADERS.keys())}"
        )
        return settings
    except Exception as e:
        logger.critical(f"Unexpected error loading settings: {e}")
        return Settings()
