from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.middleware.security import add_security_headers
from app.core.redis import init_redis_client, close_redis_client
from pathlib import Path
import sys
import uvicorn

# Path resolution
sys.path.append(str(Path(__file__).parent.parent))

# Settings
settings = get_settings()

# Logging
logger = setup_logging()

# FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-grade AI platform",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=None if getattr(settings, "ENVIRONMENT", "production") == "production" else "/docs",
    redoc_url=None
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
app.middleware("http")(add_security_headers)

# Redis
@app.on_event("startup")
async def startup_event():
    try:
        app.state.redis = await init_redis_client()
        logger.info("Redis client initialized successfully")
    except Exception as e:
        logger.critical(f"Failed to initialize Redis client: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    try:
        if app.state.redis:
            await close_redis_client(app.state.redis)
            logger.info("Redis client closed successfully")
    except Exception as e:
        logger.error(f"Failed to close Redis client: {e}")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        log_level=settings.LOG_LEVEL.lower(),
        reload=settings.ENVIRONMENT == "development",
        workers=1
    )
