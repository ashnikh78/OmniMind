# services/api/app/config/settings.py

import json
import logging
import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    PROJECT_NAME: str = "OmniMind"
    ENVIRONMENT: str = "production"
    REDIS_URL: str = "redis://redis:6379/0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REDIS_URL: str
    DATABASE_URL: str
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:80", "http://frontend:80", "https://app.apiplatform.ai"]
    LOG_LEVEL: str = "INFO"
    PROMETHEUS_MULTIPROC_DIR: str = "/tmp/prometheus"
    ML_SERVICE_URL: str = "http://ollama:11434"
    OLLAMA_HOST: str = "http://ollama:11434"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAIL_FROM: str
    METRICS_URL: str = "http://prometheus:9090"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        logger.debug(f"Parsing BACKEND_CORS_ORIGINS: raw value = {v}, type = {type(v)}")
        try:
            if isinstance(v, str):
                v = v.strip()
                if not v:
                    return []
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed if str(origin).strip()]
                except json.JSONDecodeError:
                    return [origin.strip() for origin in v.split(",") if origin.strip()]
            elif isinstance(v, (list, tuple)):
                return [str(origin).strip() for origin in v if str(origin).strip()]
            elif v is None:
                return []
            else:
                logger.warning(f"Unexpected BACKEND_CORS_ORIGINS type: {type(v)}")
                return v
        except Exception as e:
            logger.error(f"Failed to parse BACKEND_CORS_ORIGINS: {e}, value: {v}")
            raise ValueError(f"Invalid BACKEND_CORS_ORIGINS: {v}") from e

    class Config:
        env_file = "/app/.env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        env_nested_delimiter = ","
        extra = "allow"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        logger.debug(f"Settings initialized: API_V1_STR={self.API_V1_STR}")

settings = Settings()
logger.debug("Settings module loaded")