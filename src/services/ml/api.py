from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from prometheus_client import make_asgi_app
import time

from ..core.config import settings
from .models import InferenceRequest, InferenceResponse, ModelMetrics
from .service import ml_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="OmniMind ML Service",
    description="ML service for OmniMind project management system",
    version=settings.APP_VERSION
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time header to response."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


@app.post("/inference", response_model=InferenceResponse)
async def inference(request: InferenceRequest):
    """Handle model inference requests."""
    try:
        return await ml_service.inference(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error during inference: {str(e)}")
        raise HTTPException(status_code=500, detail="Model inference failed")


@app.get("/models")
async def list_models():
    """List available models and their configurations."""
    try:
        return await ml_service.list_models()
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list models")


@app.get("/metrics/{model_name}", response_model=ModelMetrics)
async def get_metrics(model_name: str):
    """Get metrics for a specific model."""
    try:
        return await ml_service.get_metrics(model_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get metrics")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check Ollama service
        client = await ml_service.client
        response = await client.get(f"{settings.OLLAMA_HOST}/api/health")
        ollama_healthy = response.status_code == 200
        
        return {
            "status": "healthy" if ollama_healthy else "degraded",
            "services": {
                "ollama": ollama_healthy
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    await ml_service.close() 