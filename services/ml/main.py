from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import httpx
import logging
from prometheus_client import Counter, Histogram, Gauge
import time
import json
import os
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
MODEL_REQUESTS = Counter('ml_model_requests_total', 'Total model requests', ['model_name', 'status'])
MODEL_LATENCY = Histogram('ml_model_latency_seconds', 'Model inference latency', ['model_name'])
GPU_MEMORY = Gauge('ml_gpu_memory_usage', 'GPU memory usage', ['gpu_id'])
MODEL_LOAD = Gauge('ml_model_load', 'Model load percentage', ['model_name'])

app = FastAPI(title="OmniMind ML Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model registry
MODELS = {
    "fast": {
        "name": "tinyllama",
        "endpoint": "http://ollama:11434/api/generate",
        "max_tokens": 512,
        "temperature": 0.7
    },
    "balanced": {
        "name": "llama2-7b",
        "endpoint": "http://ollama:11434/api/generate",
        "max_tokens": 1024,
        "temperature": 0.5
    },
    "precise": {
        "name": "llama2-70b",
        "endpoint": "http://ollama:11434/api/generate",
        "max_tokens": 2048,
        "temperature": 0.3
    },
    "coding": {
        "name": "codellama",
        "endpoint": "http://ollama:11434/api/generate",
        "max_tokens": 2048,
        "temperature": 0.2
    }
}

class InferenceRequest(BaseModel):
    prompt: str
    model: str = "balanced"
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    stream: bool = False

class ModelMetrics(BaseModel):
    model_name: str
    requests: int
    avg_latency: float
    error_rate: float
    gpu_memory_usage: float

async def get_model_metrics(model_name: str) -> ModelMetrics:
    """Get metrics for a specific model."""
    return ModelMetrics(
        model_name=model_name,
        requests=MODEL_REQUESTS.labels(model_name=model_name)._value.get(),
        avg_latency=MODEL_LATENCY.labels(model_name=model_name)._sum.get() / 
                   max(MODEL_LATENCY.labels(model_name=model_name)._count.get(), 1),
        error_rate=0.0,  # Calculate from error counter
        gpu_memory_usage=GPU_MEMORY.labels(gpu_id="0")._value.get()
    )

@app.post("/inference")
async def inference(request: InferenceRequest):
    """Handle model inference requests."""
    if request.model not in MODELS:
        raise HTTPException(status_code=404, detail=f"Model {request.model} not found")
    
    model_config = MODELS[request.model]
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                model_config["endpoint"],
                json={
                    "model": model_config["name"],
                    "prompt": request.prompt,
                    "max_tokens": request.max_tokens or model_config["max_tokens"],
                    "temperature": request.temperature or model_config["temperature"],
                    "stream": request.stream
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Model inference failed")
            
            result = response.json()
            duration = time.time() - start_time
            
            # Record metrics
            MODEL_REQUESTS.labels(model_name=request.model, status="success").inc()
            MODEL_LATENCY.labels(model_name=request.model).observe(duration)
            
            return result
            
    except Exception as e:
        logger.error(f"Error during inference: {str(e)}")
        MODEL_REQUESTS.labels(model_name=request.model, status="error").inc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def list_models():
    """List available models and their configurations."""
    return {
        name: {
            "name": config["name"],
            "max_tokens": config["max_tokens"],
            "temperature": config["temperature"]
        }
        for name, config in MODELS.items()
    }

@app.get("/metrics/{model_name}")
async def get_metrics(model_name: str):
    """Get metrics for a specific model."""
    if model_name not in MODELS:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    return await get_model_metrics(model_name)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://ollama:11434/api/health")
            return {"status": "healthy", "ollama": response.status_code == 200}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 