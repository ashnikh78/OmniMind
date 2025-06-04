from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect, status, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
import redis
import json
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional
from passlib.context import CryptContext
from config import settings
from app.routers import auth as auth_router
from app.dependencies import get_current_active_user
from app.schemas import ChatMessage

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
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
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in settings.SECURITY_HEADERS.items():
        response.headers[header] = value
    return response

# Initialize OAuth2 and password context
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Track application start time
start_time = time.time()

def init_redis_client(max_retries: int = 3, retry_delay: int = 1) -> Optional[redis.Redis]:
    """Initialize Redis client with retry logic."""
    logger.info(f"Connecting to Redis at {settings.REDIS_URL}")
    for attempt in range(max_retries):
        try:
            client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            client.ping()
            logger.info("Redis connection established")
            return client
        except redis.RedisError as e:
            logger.error(f"Redis connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
    logger.error("Failed to connect to Redis after retries")
    return None

# Initialize Redis and app state
redis_client = init_redis_client()
app.state.redis_client = redis_client
app.state.settings = settings
app.state.pwd_context = pwd_context

class ConnectionManager:
    """Manage WebSocket connections."""
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.user_data: Dict[str, Dict] = {}

    async def connect(self, websocket: WebSocket, client_id: str, user_data: Dict) -> None:
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        self.user_data[client_id] = user_data
        logger.debug(f"WebSocket connected: client_id={client_id}")

    def disconnect(self, websocket: WebSocket, client_id: str) -> None:
        if client_id in self.active_connections:
            self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
                del self.user_data[client_id]
                logger.debug(f"WebSocket disconnected: client_id={client_id}")

    async def broadcast(self, message: Dict, exclude: Optional[str] = None) -> None:
        for client_id, connections in list(self.active_connections.items()):
            if client_id != exclude:
                for connection in connections:
                    try:
                        await connection.send_json(message)
                    except (WebSocketDisconnect, RuntimeError) as e:
                        logger.debug(f"Broadcast error to {client_id}: {e}")
                        self.disconnect(connection, client_id)

manager = ConnectionManager()

@app.get("/health", tags=["health"])
async def health_check():
    """Check application health."""
    status = {
        "status": "healthy",
        "redis": "connected" if app.state.redis_client else "disconnected",
        "uptime": time.time() - start_time
    }
    if app.state.redis_client:
        try:
            app.state.redis_client.ping()
        except redis.RedisError as e:
            status["redis"] = f"error: {str(e)}"
    return status

@app.post("/api/chat/messages", tags=["chat"])
async def create_chat_message(message: ChatMessage, current_user: Dict = Depends(get_current_active_user)):
    """Create and broadcast a chat message."""
    if not app.state.redis_client:
        raise HTTPException(status_code=503, detail="Redis service unavailable")
    
    message_id = app.state.redis_client.incr("chat_message_counter")
    message_dict = message.dict()
    message_dict["id"] = str(message_id)
    message_dict["timestamp"] = datetime.utcnow().isoformat()
    
    try:
        app.state.redis_client.set(f"chat_message:{message_id}", json.dumps(message_dict))
        app.state.redis_client.lpush("recent_chat_messages", json.dumps(message_dict))
        app.state.redis_client.ltrim("recent_chat_messages", 0, 999)
        await manager.broadcast({"type": "chat", "data": message_dict})
        return message_dict
    except redis.RedisError as e:
        logger.error(f"Redis error in create_chat_message: {e}")
        raise HTTPException(status_code=503, detail="Redis service unavailable")

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, token: str = Query(...)):
    """Handle WebSocket connections."""
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
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "heartbeat":
                    await websocket.send_json({"type": "heartbeat"})
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client_id={client_id}: {e}")
        manager.disconnect(websocket, client_id)

@app.on_event("startup")
async def startup_event():
    """Handle application startup."""
    logger.info("Starting FastAPI application")
    if app.state.redis_client:
        try:
            app.state.redis_client.ping()
            logger.info("Redis connection verified on startup")
        except redis.RedisError as e:
            logger.error(f"Redis connection failed on startup: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Handle application shutdown."""
    logger.info("Shutting down FastAPI application")
    if app.state.redis_client:
        try:
            app.state.redis_client.close()
            logger.info("Redis connection closed")
        except redis.RedisError as e:
            logger.error(f"Redis shutdown failed: {e}")

# Include routers
try:
    app.include_router(auth_router.router)
    app.include_router(auth_router.user_router)
    logger.info("Auth routers included successfully")
except Exception as e:
    logger.error(f"Failed to include auth routers: {e}", exc_info=True)
    raise

if __name__ == "__main__":
    import uvicorn
    import traceback
    try:
        logger.info("Starting FastAPI application")
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")
    except Exception as e:
        logger.error(f"Failed to start FastAPI application: {e}")
        logger.error(traceback.format_exc())
        raise