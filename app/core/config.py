from pydantic import BaseSettings
from typing import Dict, Any, Optional
import os

class ModelConfig(BaseSettings):
    CACHE_SIZE: int = 10
    MAX_CONCURRENT: int = 5
    FALLBACK_THRESHOLD: float = 0.8
    PERFORMANCE_WINDOW: int = 1000
    COST_TRACKING: bool = True

class KnowledgeConfig(BaseSettings):
    VECTOR_DIM: int = 1536
    CACHE_TTL: int = 3600
    MAX_RESULTS: int = 10
    RERANK_THRESHOLD: float = 0.7
    GRAPH_ENABLED: bool = True

class VoiceConfig(BaseSettings):
    SAMPLE_RATE: int = 16000
    CHUNK_SIZE: int = 1024
    VAD_THRESHOLD: float = 0.5
    MAX_DURATION: int = 30
    NOISE_REDUCTION: bool = True

class ComplianceConfig(BaseSettings):
    AUDIT_RETENTION_DAYS: int = 365
    ENCRYPTION_LEVEL: str = "field"
    CONSENT_REQUIRED: bool = True
    DATA_RETENTION_DAYS: int = 90
    LOG_LEVEL: str = "INFO"

class CacheConfig(BaseSettings):
    REDIS_TTL: int = 3600
    MEMORY_LIMIT: int = 1024
    PERSISTENCE: bool = True
    COMPRESSION: bool = True

class MonitoringConfig(BaseSettings):
    METRICS_INTERVAL: int = 15
    ALERT_THRESHOLD: float = 0.95
    LOG_LEVEL: str = "INFO"
    TRACING_ENABLED: bool = True

class Settings(BaseSettings):
    # Core settings
    DEBUG: bool = False
    ENVIRONMENT: str = "production"
    API_VERSION: str = "1.0.0"
    
    # Component configurations
    model: ModelConfig = ModelConfig()
    knowledge: KnowledgeConfig = KnowledgeConfig()
    voice: VoiceConfig = VoiceConfig()
    compliance: ComplianceConfig = ComplianceConfig()
    cache: CacheConfig = CacheConfig()
    monitoring: MonitoringConfig = MonitoringConfig()
    
    # Service endpoints
    OLLAMA_HOST: str = "http://ollama:11434"
    REDIS_URL: str = "redis://redis:6379"
    POSTGRES_URL: str = "postgresql://omnimind:omnimind@postgres:5432/omnimind"
    NEO4J_URL: str = "bolt://neo4j:7687"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Global settings instance
settings = Settings() 