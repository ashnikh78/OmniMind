from typing import Dict, List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime


class ModelConfig(BaseModel):
    """Configuration for a model."""
    name: str
    endpoint: str
    max_tokens: int = Field(default=1024, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=50, ge=1)
    repetition_penalty: float = Field(default=1.1, ge=1.0)
    stop_sequences: List[str] = Field(default_factory=list)
    system_prompt: Optional[str] = None


class InferenceRequest(BaseModel):
    """Request for model inference."""
    prompt: str
    model: str = "balanced"
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    repetition_penalty: Optional[float] = None
    stop_sequences: Optional[List[str]] = None
    system_prompt: Optional[str] = None
    stream: bool = False


class TokenUsage(BaseModel):
    """Token usage statistics."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class InferenceResponse(BaseModel):
    """Response from model inference."""
    text: str
    model: str
    usage: TokenUsage
    finish_reason: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ModelMetrics(BaseModel):
    """Metrics for a model."""
    model_name: str
    requests: int
    avg_latency: float
    error_rate: float
    gpu_memory_usage: float
    tokens_per_second: float
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class ModelRegistry(BaseModel):
    """Registry of available models."""
    models: Dict[str, ModelConfig]
    
    def get_model_config(self, model_name: str) -> ModelConfig:
        """Get configuration for a specific model."""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        return self.models[model_name]


# Default model registry
DEFAULT_MODELS = ModelRegistry(
    models={
        "fast": ModelConfig(
            name="tinyllama",
            endpoint="http://ollama:11434/api/generate",
            max_tokens=512,
            temperature=0.7
        ),
        "balanced": ModelConfig(
            name="llama2-7b",
            endpoint="http://ollama:11434/api/generate",
            max_tokens=1024,
            temperature=0.5
        ),
        "precise": ModelConfig(
            name="llama2-70b",
            endpoint="http://ollama:11434/api/generate",
            max_tokens=2048,
            temperature=0.3
        ),
        "coding": ModelConfig(
            name="codellama",
            endpoint="http://ollama:11434/api/generate",
            max_tokens=2048,
            temperature=0.2,
            system_prompt="You are an expert programmer. Provide clear, concise, and efficient code solutions."
        )
    }
) 