# app/config/settings.py
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List, Dict, Union
from functools import lru_cache
import logging
import json
import os
from pathlib import Path

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    # Redis Configuration
    REDIS_URL: str = Field(
        default="redis://redis:6379/0",
        description="Redis connection URL in format: redis://[user:password@]host:port[/db]"
    )
    
    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@db:5432/omnimind",
        description="PostgreSQL connection URL in format: postgresql://user:password@host:port/dbname"
    )
    
    # Environment Configuration
    BACKEND_CORS_ORIGINS: List[str] = Field(
        default=["*"],
        description="List of allowed CORS origins. Use '*' for all, or provide specific origins"
    )
    LOG_LEVEL: str = Field(
        default="info",
        description="Logging level (debug, info, warning, error, critical)"
    )
    API_V1_STR: str = Field(
        default="/api/v1",
        description="API version prefix"
    )
    PROJECT_NAME: str = Field(
        default="OmniMind",
        description="Application name"
    )
    ENVIRONMENT: str = Field(
        default="production",
        description="Application environment (development|staging|production)"
    )
    
    # Security Headers Configuration
    SECURITY_HEADERS: Dict[str, str] = Field(
        default={
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY", 
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": "default-src 'self'",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
        },
        description="Security headers to be added to all responses"
    )

    @field_validator('BACKEND_CORS_ORIGINS', mode='before')
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse and validate CORS origins from environment variable."""
        if v is None:
            return ["*"]
            
        if isinstance(v, list):
            return v
            
        if isinstance(v, str):
            v = v.strip().strip('"').strip("'")
            
            if not v or v == "*":
                return ["*"]
                
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item) for item in parsed]
                except (json.JSONDecodeError, TypeError):
                    pass
                    
            return [x.strip() for x in v.split(",") if x.strip()]
            
        return ["*"]

    @field_validator('SECURITY_HEADERS', mode='before')
    def parse_security_headers(cls, v: Union[str, Dict[str, str]]) -> Dict[str, str]:
        """Parse security headers from JSON string if needed."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                logger.warning("Failed to parse SECURITY_HEADERS as JSON, using defaults")
                return cls.model_fields['SECURITY_HEADERS'].default
        return v

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
        extra = "ignore"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings with comprehensive error handling."""
    try:
        settings = Settings()
        logger.info(
            f"Settings loaded. CORS origins: {settings.BACKEND_CORS_ORIGINS}\n"
            f"Security headers: {list(settings.SECURITY_HEADERS.keys())}"
        )
        return settings
    except ValidationError as e:
        logger.error(f"Configuration validation error: {e}")
        return Settings()  # Fallback to defaults
    except Exception as e:
        logger.critical(f"Unexpected error loading settings: {e}")
        return Settings()  # Fallback to defaults