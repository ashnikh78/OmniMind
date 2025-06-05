from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.core import get_settings
from app.middleware.security import add_security_headers
from app.core.redis import init_redis_client, close_redis_client
import time

# Initialize settings first
settings = get_settings()

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-grade AI platform for authentication and chat.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
app.middleware("http")(add_security_headers)

# Initialize app state (Redis will be initialized in startup event)
app.state.redis_client = None
app.state.start_time = time.time()

# Lazy import routers
def include_routers():
    from app.api.endpoints import health_router, chat_router
    from app.routers.auth import router as auth_router, user_router
    
    app.include_router(health_router, tags=["health"])
    app.include_router(chat_router, prefix=settings.API_V1_STR, tags=["chat"])
    app.include_router(auth_router, prefix=settings.API_V1_STR, tags=["auth"])
    app.include_router(user_router, prefix=settings.API_V1_STR, tags=["users"])

include_routers()

@app.on_event("startup")
def startup_event():
    """Initialize Redis connection on startup"""
    logger.info("Starting FastAPI application")
    try:
        app.state.redis_client = init_redis_client()
        if app.state.redis_client and app.state.redis_client.ping():
            logger.info("Redis connection verified")
        else:
            logger.error("Failed to establish Redis connection")
    except Exception as e:
        logger.error(f"Startup error: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up Redis connection on shutdown"""
    logger.info("Shutting down FastAPI application")
    if app.state.redis_client:
        await close_redis_client(app.state.redis_client)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        log_level=settings.LOG_LEVEL.lower(),
        reload=settings.ENVIRONMENT == "development"
    )