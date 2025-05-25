import asyncio
import logging
from typing import Dict, Optional
import httpx
from prometheus_client import Counter, Histogram, Gauge
import time

from ..core.config import settings
from .models import (
    ModelConfig,
    InferenceRequest,
    InferenceResponse,
    TokenUsage,
    ModelMetrics,
    ModelRegistry,
    DEFAULT_MODELS
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
MODEL_REQUESTS = Counter(
    'ml_model_requests_total',
    'Total model requests',
    ['model_name', 'status']
)
MODEL_LATENCY = Histogram(
    'ml_model_latency_seconds',
    'Model inference latency',
    ['model_name']
)
GPU_MEMORY = Gauge(
    'ml_gpu_memory_usage',
    'GPU memory usage',
    ['gpu_id']
)
MODEL_LOAD = Gauge(
    'ml_model_load',
    'Model load percentage',
    ['model_name']
)


class MLService:
    """Service for handling ML operations."""
    
    def __init__(
        self,
        model_registry: ModelRegistry = DEFAULT_MODELS,
        client: Optional[httpx.AsyncClient] = None
    ):
        self.model_registry = model_registry
        self._client = client
        self._metrics: Dict[str, ModelMetrics] = {}
    
    @property
    async def client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
            )
        return self._client
    
    async def close(self):
        """Close HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
    
    async def inference(self, request: InferenceRequest) -> InferenceResponse:
        """Perform model inference."""
        start_time = time.time()
        model_config = self.model_registry.get_model_config(request.model)
        
        try:
            # Prepare request parameters
            params = {
                "model": model_config.name,
                "prompt": request.prompt,
                "max_tokens": request.max_tokens or model_config.max_tokens,
                "temperature": request.temperature or model_config.temperature,
                "top_p": request.top_p or model_config.top_p,
                "top_k": request.top_k or model_config.top_k,
                "repetition_penalty": request.repetition_penalty or model_config.repetition_penalty,
                "stop": request.stop_sequences or model_config.stop_sequences,
                "stream": request.stream
            }
            
            if model_config.system_prompt:
                params["system"] = model_config.system_prompt
            
            # Make request to model endpoint
            client = await self.client
            response = await client.post(
                model_config.endpoint,
                json=params
            )
            response.raise_for_status()
            result = response.json()
            
            # Calculate metrics
            duration = time.time() - start_time
            MODEL_LATENCY.labels(model_name=request.model).observe(duration)
            MODEL_REQUESTS.labels(model_name=request.model, status="success").inc()
            
            # Update model metrics
            self._update_metrics(request.model, duration, False)
            
            # Construct response
            return InferenceResponse(
                text=result["response"],
                model=request.model,
                usage=TokenUsage(
                    prompt_tokens=result.get("prompt_tokens", 0),
                    completion_tokens=result.get("completion_tokens", 0),
                    total_tokens=result.get("total_tokens", 0)
                ),
                finish_reason=result.get("finish_reason", "stop")
            )
            
        except Exception as e:
            logger.error(f"Error during inference: {str(e)}")
            MODEL_REQUESTS.labels(model_name=request.model, status="error").inc()
            self._update_metrics(request.model, time.time() - start_time, True)
            raise
    
    def _update_metrics(self, model_name: str, latency: float, is_error: bool):
        """Update model metrics."""
        if model_name not in self._metrics:
            self._metrics[model_name] = ModelMetrics(
                model_name=model_name,
                requests=0,
                avg_latency=0.0,
                error_rate=0.0,
                gpu_memory_usage=0.0,
                tokens_per_second=0.0
            )
        
        metrics = self._metrics[model_name]
        metrics.requests += 1
        metrics.avg_latency = (
            (metrics.avg_latency * (metrics.requests - 1) + latency) / metrics.requests
        )
        metrics.error_rate = (
            (metrics.error_rate * (metrics.requests - 1) + (1 if is_error else 0)) / metrics.requests
        )
    
    async def get_metrics(self, model_name: str) -> ModelMetrics:
        """Get metrics for a specific model."""
        if model_name not in self._metrics:
            raise ValueError(f"No metrics available for model {model_name}")
        return self._metrics[model_name]
    
    async def list_models(self) -> Dict[str, ModelConfig]:
        """List available models and their configurations."""
        return {
            name: ModelConfig(
                name=config.name,
                endpoint=config.endpoint,
                max_tokens=config.max_tokens,
                temperature=config.temperature
            )
            for name, config in self.model_registry.models.items()
        }


# Create singleton instance
ml_service = MLService() 