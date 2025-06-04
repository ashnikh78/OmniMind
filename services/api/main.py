from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import Dict, List, Optional
import httpx
import redis
import json
import asyncio
import logging
from datetime import datetime
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import time
import psutil
import ollama
from fastapi.openapi.utils import get_openapi
from config import settings
from app.routers import auth as auth_router
from app.dependencies import get_current_active_user
from app.schemas import Collaborator, Document, ChatMessage

start_time = time.time()

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-grade AI platform for chat, documents, and AI model management.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

tags_metadata = [
    {"name": "auth", "description": "User authentication and management endpoints."},
    {"name": "chat", "description": "Real-time chat functionality and message history."},
    {"name": "documents", "description": "Document creation, management, and collaboration."},
    {"name": "ai-models", "description": "AI model management and interaction."},
    {"name": "presence", "description": "User presence and activity tracking."},
    {"name": "metrics", "description": "Prometheus metrics and system statistics."},
    {"name": "health", "description": "System health checks."}
]

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version="1.0.0",
        description="API documentation for OmniMind AI platform.",
        routes=app.routes,
        tags=tags_metadata
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in settings.SECURITY_HEADERS.items():
        response.headers[header] = value
    return response

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'])

def init_redis_client(max_retries: int = 3, retry_delay: int = 1) -> redis.Redis:
    logger.info(f"Attempting to connect to Redis at {settings.REDIS_URL}")
    for attempt in range(max_retries):
        try:
            redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            redis_client.ping()
            logger.info("Successfully connected to Redis")
            return redis_client
        except redis.RedisError as e:
            logger.error(f"Redis connection attempt {attempt + 1}/{max_retries} failed: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
    logger.error("Failed to connect to Redis after all retries. Starting without Redis.")
    return None

redis_client = init_redis_client()
app.state.redis_client = redis_client
app.state.settings = settings
app.state.pwd_context = auth_service.pwd_context
http_client = httpx.AsyncClient(timeout=30.0)

class UserPresence:
    def __init__(self):
        self.online_users: Dict[str, Dict] = {}
        self.user_activities: Dict[str, List[Dict]] = {}

    def user_connected(self, user_id: str, user_data: dict) -> None:
        self.online_users[user_id] = {
            **user_data,
            "last_seen": datetime.utcnow().isoformat(),
            "status": "online"
        }
        self._add_activity(user_id, "connected")

    def user_disconnected(self, user_id: str) -> None:
        if user_id in self.online_users:
            self.online_users[user_id]["status"] = "offline"
            self.online_users[user_id]["last_seen"] = datetime.utcnow().isoformat()
            self._add_activity(user_id, "disconnected")

    def _add_activity(self, user_id: str, activity: str) -> None:
        if user_id not in self.user_activities:
            self.user_activities[user_id] = []
        self.user_activities[user_id].append({
            "activity": activity,
            "timestamp": datetime.utcnow().isoformat()
        })
        self.user_activities[user_id] = self.user_activities[user_id][-100:]

    def get_online_users(self) -> Dict[str, Dict]:
        return self.online_users

user_presence = UserPresence()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.user_data: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, client_id: str, user_data: dict) -> None:
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        self.user_data[client_id] = user_data
        user_presence.user_connected(client_id, user_data)
        await self.broadcast_user_presence()

    def disconnect(self, websocket: WebSocket, client_id: str) -> None:
        if client_id in self.active_connections:
            self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
                user_presence.user_disconnected(client_id)
                asyncio.create_task(self.broadcast_user_presence())
        if client_id in self.user_data:
            del self.user_data[client_id]

    async def broadcast_user_presence(self) -> None:
        await self.broadcast({"type": "presence", "data": user_presence.get_online_users()})

    async def broadcast(self, message: dict, exclude: Optional[str] = None) -> None:
        for client_id, connections in self.active_connections.items():
            if client_id != exclude:
                for connection in connections:
                    try:
                        await connection.send_json(message)
                    except WebSocketDisconnect:
                        self.disconnect(connection, client_id)
                    except Exception as e:
                        logger.error(f"Error broadcasting to {client_id}: {str(e)}")
                        self.disconnect(connection, client_id)

manager = ConnectionManager()

class AnalyticsMetrics:
    def __init__(self):
        self.request_counts = REQUEST_COUNT
        self.request_latency = REQUEST_LATENCY
        self.websocket_connections = Gauge('websocket_connections_total', 'Total WebSocket connections')

analytics = AnalyticsMetrics()

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if not app.state.redis_client:
        return await call_next(request)
    client_ip = request.client.host
    current_minute = datetime.utcnow().strftime("%Y-%m-%d-%H-%M")
    key = f"rate_limit:{client_ip}:{current_minute}"
    try:
        count = app.state.redis_client.get(key)
        count = int(count) if count else 0
        if count >= 100:
            raise HTTPException(status_code=429, detail="Too many requests")
        app.state.redis_client.incr(key)
        app.state.redis_client.expire(key, 60)
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        analytics.request_counts.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()
        analytics.request_latency.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)
        return response
    except redis.RedisError:
        return await call_next(request)

@app.get("/health", tags=["health"])
async def health_check():
    status = {
        "status": "healthy",
        "redis": "connected" if app.state.redis_client else "disconnected",
        "uptime": time.time() - start_time,
        "cpu_usage": psutil.cpu_percent(),
        "memory_usage": psutil.virtual_memory().used
    }
    if app.state.redis_client:
        try:
            app.state.redis_client.ping()
        except redis.RedisError as e:
            status["redis"] = f"error: {str(e)}"
    return status

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, token: str = Query(...)):
    user = await get_current_active_user(token, redis=app.state.redis_client)
    if not user or client_id != user["id"]:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    await manager.connect(websocket, client_id, {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"]
    })
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                if message.get("type") == "heartbeat":
                    await websocket.send_json({"type": "heartbeat"})
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                await websocket.send_json({"error": "Internal server error"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up FastAPI application")
    try:
        if app.state.redis_client:
            app.state.redis_client.ping()
            logger.info("Redis connection verified on startup")
        analytics.websocket_connections.set(0)
    except Exception as e:
        logger.error(f"Startup event failed: {str(e)}", exc_info=True)

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down FastAPI application")
    try:
        if app.state.redis_client:
            app.state.redis_client.close()
            logger.info("Redis connection closed")
        await http_client.aclose()
        logger.info("HTTP client closed")
    except Exception as e:
        logger.error(f"Shutdown event failed: {str(e)}", exc_info=True)

try:
    app.include_router(auth_router.router)
    app.include_router(auth_router.user_router)
    logger.info("Auth routers included successfully")
except Exception as e:
    logger.error(f"Failed to include auth routers: {str(e)}", exc_info=True)
    raise

if __name__ == "__main__":
    import uvicorn
    import traceback
    try:
        logger.info("Starting FastAPI application...")
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")
    except Exception as e:
        logger.error(f"Failed to start FastAPI application: {str(e)}")
        logger.error(traceback.format_exc())
        raise