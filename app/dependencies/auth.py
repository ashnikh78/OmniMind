from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.config import settings
from app.middleware.security import add_security_headers
from app.routers import auth as auth_router
from services.api.app.api.endpoints import health
from app.core.redis import init_redis_client
from services.api.app.api.endpoints import chat

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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Add security headers middleware
app.middleware("http")(add_security_headers)

# Initialize Redis and app state
app.state.redis_client = init_redis_client()

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(chat.router, prefix=settings.API_V1_STR, tags=["chat"])
app.include_router(auth_router.router, prefix=settings.API_V1_STR)
app.include_router(auth_router.user_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def startup_event():
    """Handle application startup."""
    logger.info("Starting FastAPI application")
    if app.state.redis_client:
        try:
            app.state.redis_client.ping()
            logger.info("Redis connection verified on startup")
        except Exception as e:
            logger.error(f"Redis connection failed on startup: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Handle application shutdown."""
    logger.info("Shutting down FastAPI application")
    if app.state.redis_client:
        try:
            app.state.redis_client.close()
            logger.info("Redis connection closed")
        except Exception as e:
            logger.error(f"Redis shutdown failed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level=settings.LOG_LEVEL.lower(),
        reload=settings.ENVIRONMENT == "development"
    )