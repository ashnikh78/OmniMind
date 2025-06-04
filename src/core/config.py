from typing import Optional, List, Dict
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr
import logging

# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG)
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
    
    # This can accept comma-separated values via env
    BACKEND_CORS_ORIGINS: List[str] = Field(default=["*"], alias="CORS_ORIGINS")

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
            "userinfo_url": ""
        }
    }

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="forbid"
    )


settings = Settings()
