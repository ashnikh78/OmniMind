from typing import Optional, List, Dict
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr, HttpUrl
import os
import logging

# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG)  # Set to DEBUG for more details
logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """Application settings."""
    
    # Application
    APP_NAME: str = "OmniMind"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_RATE_LIMIT: int = 100
    API_TIMEOUT: int = 30
    
    # Security
    SECRET_KEY: SecretStr = Field(default_factory=lambda: SecretStr("your-secret-key"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    ALLOWED_HOSTS: List[str] = ["*"]
    CORS_ORIGINS: List[str] = ["*"]
    SSL_CERT_PATH: Optional[str] = None
    SSL_KEY_PATH: Optional[str] = None
    
    # Authentication
    AUTH_PROVIDERS: List[str] = ["local"]
    OAUTH2_PROVIDERS: Dict[str, Dict[str, str]] = {
        "google": {
            "client_id": "",
            "client_secret": "",
            "authorize_url": "https://accounts.google.com/o/oauth2/auth",
            "token_url": "https://oauth2.googleapis.com/token",
            "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo"
        },
        "azure": {
            "client_id": "",
            "client_secret": "",
            "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            "userinfo_url": "https://graph.microsoft.com/oidc/userinfo"
        }
    }
    SAML2_IDP_METADATA_URL: Optional[HttpUrl] = None
    SAML2_ENTITY_ID: str = "https://omnimind.example.com/saml2"
    
    # Database
    POSTGRES_USER: Optional[str] = "omnimind"
    POSTGRES_PASSWORD: Optional[SecretStr] = Field(default_factory=lambda: SecretStr("omnimind"))
    POSTGRES_HOST: Optional[str] = "localhost"
    POSTGRES_PORT: Optional[int] = 5432
    POSTGRES_DB: Optional[str] = "omnimind"
    DATABASE_URL: Optional[str] = None
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False
    
    # Redis
    REDIS_HOST: Optional[str] = "localhost"
    REDIS_PORT: Optional[int] = 6379
    REDIS_PASSWORD: Optional[SecretStr] = None
    REDIS_URL: Optional[str] = None
    REDIS_SSL: bool = False
    REDIS_CLUSTER_MODE: bool = False
    
    # ML Service
    ML_SERVICE_URL: Optional[str] = "http://ml:8000"
    OLLAMA_HOST: Optional[str] = "http://ollama:11434"
    USE_GPU: bool = False
    MODEL_CACHE_SIZE: int = 1000
    MODEL_CACHE_TTL: int = 3600
    MODEL_QUOTA_PER_USER: int = 1000
    
    # Monitoring
    PROMETHEUS_MULTIPROC_DIR: str = "/tmp"
    ENABLE_METRICS: bool = True
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: Optional[str] = None
    NEW_RELIC_LICENSE_KEY: Optional[str] = None
    
    # Storage
    STORAGE_TYPE: str = "local"
    STORAGE_BUCKET: Optional[str] = None
    STORAGE_REGION: Optional[str] = None
    STORAGE_ENCRYPTION_KEY: Optional[SecretStr] = None
    STORAGE_RETENTION_DAYS: int = 90
    
    # Celery
    CELERY_BROKER_URL: Optional[str] = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: Optional[str] = "redis://localhost:6379/0"
    CELERY_TASK_TIME_LIMIT: int = 3600
    CELERY_TASK_SOFT_TIME_LIMIT: int = 3000
    CELERY_WORKER_CONCURRENCY: int = 4
    
    # Email
    SMTP_HOST: Optional[str] = "smtp.gmail.com"
    SMTP_PORT: Optional[int] = 587
    SMTP_USER: Optional[str] = ""
    SMTP_PASSWORD: Optional[SecretStr] = Field(default_factory=lambda: SecretStr(""))
    SMTP_TLS: bool = True
    EMAIL_FROM: Optional[str] = "noreply@omnimind.example.com"
    
    # Billing
    STRIPE_SECRET_KEY: Optional[SecretStr] = None
    STRIPE_WEBHOOK_SECRET: Optional[SecretStr] = None
    STRIPE_PRICE_IDS: Dict[str, str] = {
        "basic": "price_basic",
        "pro": "price_pro",
        "enterprise": "price_enterprise"
    }
    
    # Compliance
    GDPR_ENABLED: bool = True
    DATA_RETENTION_DAYS: int = 365
    AUDIT_LOG_ENABLED: bool = True
    AUDIT_LOG_RETENTION_DAYS: int = 730
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"  # Ignore undefined environment variables
    )
    
    def __init__(self, **kwargs):
        logger.debug("Environment variables: %s", {k: v if "PASSWORD" not in k and "KEY" not in k else "****" for k, v in os.environ.items()})
        try:
            super().__init__(**kwargs)
        except Exception as e:
            logger.error("Settings validation error: %s", e)
            raise
        
        if not self.DATABASE_URL and all([self.POSTGRES_USER, self.POSTGRES_PASSWORD, self.POSTGRES_HOST, self.POSTGRES_PORT, self.POSTGRES_DB]):
            self.DATABASE_URL = (
                f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD.get_secret_value()}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        
        if not self.REDIS_URL and self.REDIS_HOST and self.REDIS_PORT:
            auth = f":{self.REDIS_PASSWORD.get_secret_value()}@" if self.REDIS_PASSWORD else ""
            protocol = "rediss" if self.REDIS_SSL else "redis"
            self.REDIS_URL = f"{protocol}://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/0"

try:
    settings = Settings()
except Exception as e:
    logger.error("Failed to initialize settings: %s", e)
    raise