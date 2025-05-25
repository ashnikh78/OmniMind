from typing import Dict, Any, List, Optional
from pydantic import BaseSettings, Field, validator
from app.core.siem_integration import SIEMProvider

class SIEMSettings(BaseSettings):
    ENABLED: bool = True
    PROVIDERS: List[Dict[str, Any]] = [
        {
            "name": "splunk",
            "type": SIEMProvider.SPLUNK,
            "config": {
                "url": "https://splunk.example.com:8088",
                "token": "your-splunk-token",
                "host": "omnimind-app",
                "index": "omnimind",
                "sourcetype": "omnimind:events"
            }
        },
        {
            "name": "qradar",
            "type": SIEMProvider.QRADAR,
            "config": {
                "url": "https://qradar.example.com",
                "token": "your-qradar-token",
                "log_source": "OmniMind",
                "log_source_type": "OmniMind Events"
            }
        },
        {
            "name": "elk",
            "type": SIEMProvider.ELK,
            "config": {
                "url": "https://elk.example.com:9200",
                "auth": "your-elastic-auth",
                "index": "omnimind-logs",
                "pipeline": "omnimind-events"
            }
        },
        {
            "name": "sentinel",
            "type": SIEMProvider.SENTINEL,
            "config": {
                "url": "https://management.azure.com",
                "token": "your-sentinel-token",
                "subscription": "your-subscription-id",
                "resource_group": "your-resource-group",
                "workspace": "your-workspace",
                "table": "OmniMindEvents"
            }
        },
        {
            "name": "datadog",
            "type": SIEMProvider.DATADOG,
            "config": {
                "url": "https://api.datadoghq.com",
                "api_key": "your-datadog-api-key",
                "app_key": "your-datadog-app-key",
                "host": "omnimind-app",
                "service": "omnimind"
            }
        },
        {
            "name": "new_relic",
            "type": SIEMProvider.NEW_RELIC,
            "config": {
                "url": "https://insights-collector.newrelic.com",
                "insert_key": "your-new-relic-insert-key",
                "account_id": "your-account-id"
            }
        },
        {
            "name": "dynatrace",
            "type": SIEMProvider.DYNA_TRACE,
            "config": {
                "url": "https://your-environment.live.dynatrace.com",
                "token": "your-dynatrace-token",
                "entity_id": "your-entity-id"
            }
        },
        {
            "name": "sumo_logic",
            "type": SIEMProvider.SUMO_LOGIC,
            "config": {
                "url": "https://collectors.sumologic.com",
                "auth": "your-sumo-auth",
                "source": "omnimind",
                "source_category": "omnimind/events"
            }
        },
        {
            "name": "graylog",
            "type": SIEMProvider.GRAYLOG,
            "config": {
                "url": "https://graylog.example.com",
                "auth": "your-graylog-auth",
                "stream": "omnimind-events"
            }
        }
    ]
    
    # Event batching settings
    BATCH_SIZE: int = Field(default=100, ge=1, le=1000)
    BATCH_INTERVAL: int = Field(default=5, ge=1, le=60)  # seconds
    
    # Retry settings
    MAX_RETRIES: int = Field(default=3, ge=0, le=10)
    RETRY_DELAY: int = Field(default=1, ge=1, le=30)  # seconds
    RETRY_BACKOFF: float = Field(default=2.0, ge=1.0, le=5.0)
    
    # Timeout settings
    CONNECT_TIMEOUT: int = Field(default=5, ge=1, le=30)  # seconds
    READ_TIMEOUT: int = Field(default=10, ge=1, le=60)  # seconds
    
    # Logging settings
    LOG_LEVEL: str = Field(default="INFO", regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Security settings
    VERIFY_SSL: bool = True
    ALLOW_SELF_SIGNED: bool = False
    CERT_PATH: Optional[str] = None
    KEY_PATH: Optional[str] = None
    
    # Event processing settings
    ENABLE_EVENT_DEDUPLICATION: bool = True
    DEDUPLICATION_WINDOW: int = 300  # seconds
    ENABLE_EVENT_ENRICHMENT: bool = True
    ENABLE_EVENT_CORRELATION: bool = True
    CORRELATION_WINDOW: int = 3600  # seconds
    
    # Alerting settings
    ENABLE_ALERTS: bool = True
    ALERT_THRESHOLDS: Dict[str, int] = {
        "critical": 1,
        "high": 5,
        "medium": 20,
        "low": 50
    }
    ALERT_CHANNELS: List[str] = ["email", "slack", "pagerduty"]
    
    # Performance monitoring settings
    ENABLE_PERFORMANCE_MONITORING: bool = True
    METRICS_RETENTION: int = 30  # days
    METRICS_AGGREGATION: str = "1m"  # 1 minute intervals
    
    # Data retention settings
    ENABLE_DATA_RETENTION: bool = True
    RETENTION_PERIOD: int = 90  # days
    ENABLE_DATA_ARCHIVING: bool = True
    ARCHIVE_FORMAT: str = "json"
    
    # Validation
    @validator("PROVIDERS")
    def validate_providers(cls, v):
        if not v:
            raise ValueError("At least one SIEM provider must be configured")
        return v
    
    @validator("CERT_PATH", "KEY_PATH")
    def validate_cert_paths(cls, v, values):
        if values.get("VERIFY_SSL") and not v:
            raise ValueError("Certificate path is required when SSL verification is enabled")
        return v
    
    class Config:
        env_prefix = "SIEM_"
        case_sensitive = True

# Initialize settings
siem_settings = SIEMSettings() 