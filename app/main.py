from fastapi import FastAPI, Request, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from typing import Dict, List, Optional, Any
import httpx
import redis
import json
import asyncio
import logging
from datetime import datetime, timedelta
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import time
import jwt
from passlib.context import CryptContext
import psutil
import ollama
from fastapi.openapi.utils import get_openapi
from config import settings
from app.routers import auth as auth_router
from app.dependencies import get_current_active_user

start_time = time.time()

logging.basicConfig(
    level=logging.INFO,
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
    {"name": "ai-models", "description": "AI model management and interaction (Ollama and ML models)."},
    {"name": "events", "description": "Event tracking and management."},
    {"name": "presence", "description": "User presence and activity tracking."},
    {"name": "analytics", "description": "Real-time and enhanced analytics for system and user activity."},
    {"name": "metrics", "description": "Prometheus metrics and system statistics."},
    {"name": "health", "description": "System health checks."},
    {"name": "root", "description": "Root endpoint for API status."}
]

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version="1.0.0",
        description="API documentation for OmniMind AI platform, providing endpoints for authentication, chat, documents, AI models, events, presence, analytics, and system monitoring.",
        routes=app.routes,
        tags=tags_metadata
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    protected_paths = [
        "/api/v1/users",
        "/api/v1/auth/me",
        "/api/v1/auth/refresh",
        "/api/chat/messages",
        "/api/chat/history",
        "/api/chat/messages/{message_id}",
        "/api/documents",
        "/api/documents/{document_id}",
        "/api/documents/current",
        "/api/documents/save",
        "/api/documents/{document_id}/history",
        "/api/documents/collaborators",
        "/api/documents/collaborators/{document_id}/{collaborator_id}",
        "/api/events",
        "/api/events/{event_id}",
        "/api/presence",
        "/api/presence/{user_id}/activities",
        "/api/analytics/realtime",
        "/api/analytics/enhanced",
        "/api/ollama/chat",
        "/api/ollama/models/{model_name}/pull",
        "/api/ollama/models/{model_name}",
        "/api/ollama/models/{model_name}/status",
        "/api/v1/ml/models",
        "/api/v1/ml/models/{model_id}",
        "/api/v1/ml/models/{model_id}/metrics"
    ]
    for path, path_item in openapi_schema["paths"].items():
        for method in path_item.values():
            method["security"] = [{"BearerAuth": []}] if path in protected_paths else []
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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'])

def init_redis_client(max_retries: int = 3, retry_delay: int = 1) -> redis.Redis:
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
            else:
                logger.error("Failed to connect to Redis after all retries")
                raise

redis_client = init_redis_client()

app.state.redis_client = redis_client
app.state.settings = settings
app.state.pwd_context = pwd_context
app.state.oauth2_scheme = oauth2_scheme

http_client = httpx.AsyncClient(timeout=30.0)

class ChatMessage(BaseModel):
    sender_id: str
    sender_name: str
    content: str
    timestamp: str
    file: Optional[dict] = None

class Document(BaseModel):
    id: str
    title: str
    content: str
    owner_id: str
    created_at: str
    updated_at: str
    collaborators: List[dict]

class DocumentUpdate(BaseModel):
    user_id: str
    content: Optional[str] = None
    title: Optional[str] = None
    timestamp: str

class Collaborator(BaseModel):
    id: str
    email: str
    role: str = "editor"

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

    def update_user_status(self, user_id: str, status: str) -> None:
        if user_id in self.online_users:
            self.online_users[user_id]["status"] = status
            self.online_users[user_id]["last_seen"] = datetime.utcnow().isoformat()
            self._add_activity(user_id, f"status_changed_{status}")

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

    def get_user_activities(self, user_id: str, limit: int = 10) -> List[Dict]:
        return self.user_activities.get(user_id, [])[-limit:]

user_presence = UserPresence()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.user_connections: Dict[str, WebSocket] = {}
        self.user_data: Dict[str, dict] = {}
        self.connection_timestamps: Dict[str, float] = {}

    async def connect(self, websocket: WebSocket, client_id: str, user_data: dict) -> None:
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        self.user_connections[client_id] = websocket
        self.user_data[client_id] = user_data
        self.connection_timestamps[client_id] = time.time()
        user_presence.user_connected(client_id, user_data)
        await self.broadcast_user_presence()

    def disconnect(self, websocket: WebSocket, client_id: str) -> None:
        if client_id in self.active_connections:
            self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
                user_presence.user_disconnected(client_id)
                asyncio.create_task(self.broadcast_user_presence())
        if client_id in self.user_connections:
            del self.user_connections[client_id]
        if client_id in self.user_data:
            del self.user_data[client_id]
        if client_id in self.connection_timestamps:
            del self.connection_timestamps[client_id]

    async def broadcast_user_presence(self) -> None:
        await self.broadcast({
            "type": "presence",
            "data": user_presence.get_online_users()
        })

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

    async def send_personal_message(self, message: dict, client_id: str) -> None:
        if client_id in self.user_connections:
            try:
                await self.user_connections[client_id].send_json(message)
            except WebSocketDisconnect:
                self.disconnect(self.user_connections[client_id], client_id)
            except Exception as e:
                logger.error(f"Error sending personal message to {client_id}: {str(e)}")
                self.disconnect(self.user_connections[client_id], client_id)

manager = ConnectionManager()

class AnalyticsMetrics:
    def __init__(self):
        self.request_counts = REQUEST_COUNT
        self.request_latency = REQUEST_LATENCY
        self.active_users = Gauge('active_users_total', 'Total active users')
        self.chat_messages = Counter('chat_messages_total', 'Total chat messages sent')
        self.file_uploads = Counter('file_uploads_total', 'Total files uploaded', ['file_type'])
        self.user_sessions = Counter('user_sessions_total', 'Total user sessions')
        self.error_count = Counter('error_count_total', 'Total errors', ['type'])
        self.websocket_connections = Gauge('websocket_connections_total', 'Total WebSocket connections')
        self.api_latency = Histogram('api_latency_seconds', 'API endpoint latency', ['endpoint'])
        self.cache_hits = Counter('cache_hits_total', 'Total cache hits')
        self.cache_misses = Counter('cache_misses_total', 'Total cache misses')
        self.memory_usage = Gauge('memory_usage_bytes', 'Memory usage in bytes')
        self.cpu_usage = Gauge('cpu_usage_percent', 'CPU usage percentage')

analytics = AnalyticsMetrics()

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    current_minute = datetime.utcnow().strftime("%Y-%m-%d-%H-%M")
    key = f"rate_limit:{client_ip}:{current_minute}"
    try:
        count = redis_client.get(key)
        count = int(count) if count else 0
        if count >= 100:
            analytics.error_count.labels(type='rate_limit').inc()
            raise HTTPException(status_code=429, detail="Too many requests")
        redis_client.incr(key)
        redis_client.expire(key, 60)
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
        analytics.error_count.labels(type='redis_error').inc()
        return await call_next(request)

@app.get("/health", tags=["health"], summary="Check system health")
async def health_check():
    return {"status": "healthy"}

@app.get("/", tags=["root"], summary="API root endpoint")
async def root():
    return {
        "status": "ok",
        "message": f"{settings.PROJECT_NAME} API Gateway is running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "metrics": "/metrics",
            "api": "/api",
            "auth": f"{settings.API_V1_STR}/auth"
        }
    }

@app.post("/api/v1/auth/refresh", tags=["auth"], summary="Refresh JWT token")
async def refresh_token(request: Request, current_user: dict = Depends(get_current_active_user)):
    token = await request.json()
    token = token.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    user_data = json.loads(redis_client.get(f"user:{user_id}"))
    new_token = jwt.encode(
        {
            "sub": user_id,
            "email": user_data["email"],
            "role": user_data["role"],
            "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "user": {"id": user_id, "email": user_data["email"], "role": user_data["role"]}
    }

@app.get("/api/v1/auth/me", tags=["auth"], summary="Get current user profile")
async def get_current_user_profile(current_user: dict = Depends(get_current_active_user)):
    profile = {
        **current_user,
        "preferences": {
            "theme": "light",
            "notifications": {"email": True, "push": True, "desktop": True},
            "language": "en",
            "timezone": "UTC"
        },
        "stats": {
            "lastLogin": datetime.utcnow().isoformat(),
            "loginCount": 1,
            "documentCount": 0,
            "messageCount": 0
        },
        "roles": [current_user.get("role", "user")],
        "permissions": ["read", "write"] if current_user.get("role") == "admin" else ["read"]
    }
    profile.pop("password", None)
    return profile

@app.post("/api/chat/messages", tags=["chat"], summary="Send a chat message")
async def create_chat_message(message: ChatMessage, current_user: dict = Depends(get_current_active_user)):
    message_id = redis_client.incr("chat_message_counter")
    message_dict = message.dict()
    message_dict["id"] = message_id
    redis_client.set(f"chat_message:{message_id}", json.dumps(message_dict))
    redis_client.expire(f"chat_message:{message_id}", 86400)
    redis_client.lpush("recent_chat_messages", json.dumps(message_dict))
    redis_client.ltrim("recent_chat_messages", 0, 999)
    await manager.broadcast({"type": "chat", "data": message_dict})
    analytics.chat_messages.inc()
    if message_dict.get("file"):
        file_type = message_dict["file"].get("type", "unknown")
        analytics.file_uploads.labels(file_type=file_type).inc()
        redis_client.hincrby("file_uploads_by_type", file_type, 1)
    return message_dict

@app.get("/api/chat/history", tags=["chat"], summary="Get chat history")
async def get_chat_history(limit: int = 50, current_user: dict = Depends(get_current_active_user)):
    messages = [json.loads(msg) for msg in redis_client.lrange("recent_chat_messages", 0, limit - 1)]
    return messages

@app.get("/api/chat/messages/{message_id}", tags=["chat"], summary="Get a specific chat message")
async def get_chat_message(message_id: int, current_user: dict = Depends(get_current_active_user)):
    message_json = redis_client.get(f"chat_message:{message_id}")
    if not message_json:
        raise HTTPException(status_code=404, detail="Message not found")
    return json.loads(message_json)

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, token: str = Query(...)):
    """
    WebSocket endpoint for real-time chat functionality.
    Handles heartbeat, chat messages, typing indicators, broadcasts, personal messages, and user status updates.
    """
    user = await get_current_active_user(token)
    if not user or client_id != user["id"]:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    await manager.connect(websocket, client_id, {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", "Unknown"),
        "role": user.get("role", "user")
    })
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                if message.get("type") == "heartbeat":
                    await websocket.send_json({"type": "heartbeat"})
                    continue
                if message.get("type") == "chat":
                    chat_message = ChatMessage(**message["data"])
                    await create_chat_message(chat_message, current_user=user)
                elif message.get("type") == "chat_typing":
                    await manager.broadcast({
                        "type": "chat_typing",
                        "data": {"user_id": client_id, "isTyping": message["data"]["isTyping"]}
                    })
                elif message.get("type") == "broadcast":
                    await manager.broadcast(message, exclude=client_id)
                elif message.get("type") == "personal":
                    target_id = message.get("target_id")
                    if target_id:
                        await manager.send_personal_message(message, target_id)
                elif message.get("type") == "status":
                    user_presence.update_user_status(client_id, message.get("status", "online"))
                    await manager.broadcast_user_presence()
                else:
                    await websocket.send_json({"error": "Invalid message type"})
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                await websocket.send_json({"error": "Internal server error"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
    except Exception as e:
        logger.error(f"Unexpected WebSocket error: {str(e)}")
        manager.disconnect(websocket, client_id)

@app.post("/api/documents", tags=["documents"], summary="Create a new document")
async def create_document(document: Document, current_user: dict = Depends(get_current_active_user)):
    if document.owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized owner_id")
    document_id = redis_client.incr("document_counter")
    document_dict = document.dict()
    document_dict["id"] = str(document_id)
    redis_client.set(f"document:{document_id}", json.dumps(document_dict))
    redis_client.sadd(f"user_documents:{document.owner_id}", document_id)
    redis_client.lpush(f"document_history:{document_id}", json.dumps({
        "type": "create",
        "user_id": document.owner_id,
        "timestamp": document.created_at
    }))
    return {
        "status": "success",
        "document": document_dict
    }

@app.get("/api/documents/{document_id}", tags=["documents"], summary="Get a document")
async def get_document(document_id: str, current_user: dict = Depends(get_current_active_user)):
    document_json = redis_client.get(f"document:{document_id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    document = json.loads(document_json)
    if document["owner_id"] != current_user["id"] and current_user["id"] not in [c["id"] for c in document.get("collaborators", [])]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return document

@app.get("/api/documents/current", tags=["documents"], summary="Get the current document")
async def get_current_document(current_user: dict = Depends(get_current_active_user)):
    document_id = redis_client.get(f"user_current_document:{current_user['id']}")
    if not document_id:
        raise HTTPException(status_code=404, detail="No current document")
    return await get_document(document_id, current_user)

@app.post("/api/documents/save", tags=["documents"], summary="Save a document")
async def save_document(document: Document, current_user: dict = Depends(get_current_active_user)):
    document_json = redis_client.get(f"document:{document.id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    existing_doc = json.loads(document_json)
    if existing_doc["owner_id"] != current_user["id"] and current_user["id"] not in [c["id"] for c in existing_doc.get("collaborators", [])]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    document_dict = document.dict()
    redis_client.set(f"document:{document.id}", json.dumps(document_dict))
    redis_client.lpush(f"document_history:{document.id}", json.dumps({
        "type": "update",
        "user_id": current_user["id"],
        "timestamp": document.updated_at
    }))
    await manager.broadcast({
        "type": "document_update",
        "data": {
            "document_id": document.id,
            "content": document.content,
            "title": document.title,
            "timestamp": document.updated_at
        }
    })
    return document_dict

@app.get("/api/documents/{document_id}/history", tags=["documents"], summary="Get document history")
async def get_document_history(document_id: str, limit: int = 50, current_user: dict = Depends(get_current_active_user)):
    document_json = redis_client.get(f"document:{document_id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    document = json.loads(document_json)
    if document["owner_id"] != current_user["id"] and current_user["id"] not in [c["id"] for c in document.get("collaborators", [])]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    history = [json.loads(entry) for entry in redis_client.lrange(f"document_history:{document_id}", 0, limit - 1)]
    return history

@app.post("/api/documents/collaborators", tags=["documents"], summary="Add a collaborator to a document")
async def add_collaborator(document_id: str = Query(...), collaborator: Collaborator = Body(...), current_user: dict = Depends(get_current_active_user)):
    document_json = redis_client.get(f"document:{document_id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    document = json.loads(document_json)
    if document.get("owner_id") != current_user["id"] and current_user["id"] not in [c["id"] for c in document.get("collaborators", [])]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    document_dict = document.copy()
    
    if collaborator.id not in [c["id"] for c in document_dict.get("collaborators", [])]:
        document_dict["collaborators"].append(collaborator.dict())
        redis_client.set(f"document:{document_id}", json.dumps(document_dict))
        redis_client.lpush(f"document_history:{document_id}", json.dumps({
            "type": "add_collaborator",
            "user_id": current_user["id"],
            "collaborator_id": collaborator.id,
            "timestamp": datetime.utcnow().isoformat()
        }))
        await manager.send_personal_message({
            "type": "document_invite",
            "data": {
                "document_id": document_id,
                "document_title": document_dict["title"],
                "inviter_id": current_user["id"]
            }
        }, collaborator.id)
    return document_dict

@app.delete("/api/documents/{document_id}/collaborators/{collaborator_id}", tags=["documents"], summary="Remove collaborator")
async def delete_collaborator(document_id: str, collaborator_id: str, current_user: dict = Depends(get_current_active_user)):
    document_json = redis_client.get(f"document:{document_id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    document = json.loads(document_json)
    if document["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the owner can remove collaborators")
    document_dict = document.copy()
    document_dict["collaborators"] = [c for c in document_dict.get("collaborators", []) if c["id"] != collaborator_id]
    redis_client.set(f"document:{document_id}", json.dumps(document_dict))
    redis_client.lpush(f"document_history:{document_id}", json.dumps({
        "type": "remove_collaborator",
        "user_id": current_user["id"],
        "collaborator_id": collaborator_id,
        "timestamp": datetime.utcnow().isoformat()
    }))
    await manager.send_personal_message({
        "type": "document_removed",
        "data": {
            "document_id": document_id,
            "document_title": document_dict["title"]
        }
    }, collaborator_id)
    return {"status": "success"}

@app.get("/api/ollama/models", tags=["ai-models"], summary="List available Ollama models")
async def get_available_models(current_user: dict = Depends(get_current_active_user)):
    try:
        client = ollama.Client(host=settings.OLLAMA_HOST)
        models = await client.list()
        return models.get("models", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ollama/chat", tags=["ai-models"], summary="Chat with an Ollama model")
async def chat_with_model(request: Dict[str, Any], current_user: dict = Depends(get_current_active_user)):
    try:
        model_name = request.get("model", "llama2")
        message = request.get("content", "")
        settings_dict = request.get("settings", {})
        persona = request.get("persona", None)
        prompt = f"[Persona: {persona.get('name', persona)}]\n{persona.get('prompt', '')}\n\n{message}" if persona else message
        
        response = await ollama.Client(host=settings.OLLAMA_HOST).generate(
            model=model_name,
            prompt=prompt,
            options={
                "temperature": settings_dict.get("temperature", 0.7),
                "num_predict": settings_dict.get("maxTokens", 2048),
                "top_p": settings_dict.get("topP", 0.9)
            }
        )
        chat_message = {
            "sender_id": "ai",
            "sender_name": f"{model_name.capitalize()} AI",
            "content": response["response"],
            "timestamp": datetime.utcnow().isoformat(),
            "model": model_name,
            "persona": persona,
            "settings": settings_dict,
            "metrics": {
                "latency": response.get("total_duration", 0) / 1e9,
                "gpu_memory": 0
            }
        }
        message_id = redis_client.incr("chat_message_counter")
        chat_message["id"] = message_id
        redis_client.set(f"chat_message:{message_id}", json.dumps(chat_message))
        redis_client.expire(f"chat_message:{message_id}", 86400)
        redis_client.lpush("recent_chat_messages", json.dumps(chat_message))
        redis_client.ltrim("recent_chat_messages", 0, 999)
        await manager.broadcast({"type": "chat", "data": chat_message})
        return chat_message
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ollama/models/{model_name}/pull", tags=["ai-models"], summary="Pull an Ollama model")
async def pull_model(model_name: str, current_user: dict = Depends(get_current_active_user)):
    try:
        client = ollama.Client(host=settings.OLLAMA_HOST)
        await client.pull(model_name)
        return {"status": "success", "message": f"Model {model_name} pulled successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/ollama/models/{model_name}", tags=["ai-models"], summary="Delete an Ollama model")
async def delete_model(model_name: str, current_user: dict = Depends(get_current_active_user)):
    try:
        client = ollama.Client(host=settings.OLLAMA_HOST)
        await client.delete(model_name)
        return {"status": "success", "message": f"Model {model_name} deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting model: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ollama/models/{model_name}/status", tags=["ai-models"], summary="Get Ollama model status")
async def get_model_status(model_name: str, current_user: dict = Depends(get_current_active_user)):
    try:
        client = ollama.Client(host=settings.OLLAMA_HOST)
        models = await client.list()
        model = next((m for m in models.get("models", []) if m["name"] == model_name), None)
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        return {
            "name": model_name,
            "loaded": True,
            "last_used": datetime.utcnow().isoformat(),
            "concurrent_requests": 0,
            "gpu_enabled": False,
            "gpu_memory": 0
        }
    except Exception as e:
        logger.error(f"Error in get_model_status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/ml/models", tags=["ai-models"], summary="List ML models")
async def get_ml_models(current_user: dict = Depends(get_current_active_user)):
    return [
        {
            "id": "model-1",
            "name": "GPT-4",
            "status": "active",
            "description": "Advanced language model for text generation and analysis",
            "capabilities": ["text-generation", "code-completion", "translation"],
            "metrics": {"accuracy": 0.95, "latency": 0.5, "throughput": 100}
        },
        {
            "id": "model-2",
            "name": "DALL-E 3",
            "status": "active",
            "description": "Image generation model",
            "capabilities": ["image-generation", "image-editing"],
            "metrics": {"quality": 0.92, "generation_time": 2.5, "success_rate": 0.98}
        },
        {
            "id": "model-3",
            "name": "Whisper",
            "status": "active",
            "description": "Speech recognition model",
            "capabilities": ["speech-to-text", "transcription"],
            "metrics": {"accuracy": 0.94, "processing_time": 1.2, "languages_supported": 50}
        }
    ]

@app.get("/api/v1/ml/models/{model_id}", tags=["ai-models"], summary="Get an ML model")
async def get_ml_model(model_id: str, current_user: dict = Depends(get_current_active_user)):
    return {
        "id": model_id,
        "name": "GPT-4",
        "status": "active",
        "description": "Advanced language model for text generation and analysis",
        "tags": ["capabilities"],
        "metrics": [
            {"accuracy": 0.95},
            {"latency": 0.5},
            {"throughput": 100}
        ],
        "config": {
            "max_tokens": 2048,
            "temperature": 0.7,
            "top_p": 0.9
        }
    }

@app.get("/api/v1/ml/models/{model_id}/metrics", tags=["ai-models"], summary="Get ML model metrics")
async def get_ml_model_metrics(model_id: str, current_user: dict = Depends(get_current_active_user)):
    try:
        return {
            "performance": {
                "accuracy": 0.95,
                "latency": 0.5,
                "throughput": 100,
                "error_rate": 0.05
            },
            "usage": {
                "requests": 1000,
                "tokens": 50000,
                "avg_latency": 0.5
            },
            "errors": [
                {"type": "timeout", "count": 20},
                {"type": "validation", "count": 15},
                {"type": "other", "count": 15}
            ]
        }
    except Exception as e:
        logger.error(f"Error in get_ml_model_metrics: {str(e)}")
        return {
            "performance": {
                "accuracy": 0,
                "latency": 0,
                "throughput": 0,
                "error_rate": 0
            },
            "usage": {
                "requests": 0,
                "tokens": 0,
                "avg_latency": 0
            },
            "errors": []
        }

@app.post("/api/events", tags=["events"], summary="Create an event")
async def create_event(event: dict, current_user: dict = Depends(get_current_active_user)):
    event_id = redis_client.incr("event_counter")
    event["id"] = event_id
    event["user_id"] = current_user["id"]
    event["timestamp"] = datetime.utcnow().isoformat()
    redis_client.set(f"event:{event_id}", json.dumps(event))
    redis_client.expire(f"event:{event_id}", 600)
    redis_client.lpush("recent_events", json.dumps(event))
    redis_client.ltrim("recent_events", 0, 99)
    await manager.broadcast({"type": "event", "data": event})
    return event

@app.get("/api/events", tags=["events"], summary="List recent events")
async def get_events(limit: int = 10, current_user: dict = Depends(get_current_active_user)):
    events = [json.loads(event) for event in redis_client.lrange("recent_events", 0, limit - 1)]
    return [e for e in events if e["user_id"] == current_user["id"]]

@app.get("/api/events/{event_id}", tags=["events"], summary="Get an event")
async def get_event(event_id: int, current_user: dict = Depends(get_current_active_user)):
    event_json = redis_client.get(f"event:{event_id}")
    if not event_json:
        raise HTTPException(status_code=404, detail="Event not found")
    event_data = json.loads(event_json)
    if event_data["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return event_data

@app.get("/api/presence", tags=["presence"], summary="Get online users")
async def get_presence(current_user: dict = Depends(get_current_active_user)):
    return user_presence.get_online_users()

@app.get("/api/presence/{user_id}/activities", tags=["presence"], summary="Get user activities")
async def get_user_activities(user_id: str, limit: int = 10, current_user: dict = Depends(get_current_active_user)):
    if user_id != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    return user_presence.get_user_activities(user_id, limit)

@app.get("/api/analytics/realtime", tags=["analytics"], summary="Get real-time analytics")
async def get_realtime_analytics(current_user: dict = Depends(get_current_active_user)):
    metrics = {
        "active_users": len(manager.user_connections),
        "total_connections": sum(len(conns) for conns in manager.active_connections.values()),
        "user_roles": {},
        "recent_activities": [],
        "system_metrics": {
            "cpu_usage": psutil.cpu_percent(),
            "memory_usage": psutil.virtual_memory().used,
            "uptime": time.time() - start_time
        }
    }
    for user_data in manager.user_data.values():
        role = user_data.get("role", "unknown")
        metrics["user_roles"][role] = metrics["user_roles"].get(role, 0) + 1
    for user_id, activities in user_presence.user_activities.items():
        metrics["recent_activities"].extend(activities[-5:])
    metrics["recent_activities"].sort(key=lambda x: x["timestamp"], reverse=True)
    metrics["recent_activities"] = metrics["recent_activities"][:20]
    try:
        redis_info = redis_client.info()
        metrics["redis"] = {
            "connected_clients": redis_info.get("connected_clients", 0),
            "used_memory": redis_info.get("used_memory_human", "0"),
            "total_connections_received": redis_info.get("total_connections_received", 0)
        }
    except redis.RedisError:
        metrics["redis"] = {"error": "Failed to get Redis metrics"}
    return metrics

@app.get("/api/analytics/enhanced", tags=["analytics"], summary="Get enhanced analytics")
async def get_enhanced_analytics(current_user: dict = Depends(get_current_active_user)):
    metrics = {
        "system": {
            "active_connections": len(manager.user_connections),
            "total_events": int(redis_client.get("event_counter") or 0),
            "recent_events_count": redis_client.llen("recent_events"),
            "redis_memory_used": redis_client.info().get("used_memory_human", "0"),
            "uptime": time.time() - start_time,
            "memory_usage": psutil.virtual_memory().used,
            "cpu_usage": psutil.cpu_percent(),
        },
        "users": {
            "active_users": len(manager.user_connections),
            "user_roles": {},
            "user_status": {"online": 0, "away": 0, "busy": 0, "offline": 0},
            "recent_activities": []
        },
        "chat": {
            "total_messages": int(redis_client.get("chat_message_counter") or 0),
            "messages_last_hour": redis_client.llen("recent_chat_messages"),
            "active_chats": len(set(json.loads(msg)["sender_id"] for msg in redis_client.lrange("recent_chat_messages", 0, -1))),
            "file_uploads": {
                "total": int(redis_client.get("file_upload_counter") or 0),
                "by_type": {k: int(v) for k, v in redis_client.hgetall("file_uploads_by_type").items()}
            }
        },
        "performance": {
            "request_counts": {"total": 0, "by_endpoint": {}, "by_status": {}},
            "latency": {"average": 0, "p95": 0, "p99": 0},
            "errors": {"total": 0, "by_type": {}}
        }
    }
    for user_data in manager.user_data.values():
        role = user_data.get("role", "unknown")
        metrics["users"]["user_roles"][role] = metrics["users"]["user_roles"].get(role, 0) + 1
        status = user_presence.online_users.get(user_data["id"], {}).get("status", "offline")
        metrics["users"]["user_status"][status] = metrics["users"]["user_status"].get(status, 0) + 1
    for user_id, activities in user_presence.user_activities.items():
        metrics["users"]["recent_activities"].extend(activities[-5:])
    metrics["users"]["recent_activities"].sort(key=lambda x: x["timestamp"], reverse=True)
    metrics["users"]["recent_activities"] = metrics["users"]["recent_activities"][:20]
    return metrics

@app.get("/metrics", tags=["metrics"], summary="Prometheus metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/api/metrics", tags=["metrics"], summary="System metrics")
async def get_metrics():
    return {
        "active_connections": len(manager.user_connections),
        "total_events": int(redis_client.get("event_counter") or 0),
        "recent_events_count": redis_client.llen("recent_events"),
        "redis_memory_used": redis_client.info().get("used_memory_human", "0"),
        "uptime": time.time() - start_time
    }

@app.get("/api/health/redis", tags=["health"], summary="Check Redis health")
async def redis_health_check():
    try:
        redis_client.ping()
        return {"status": "healthy", "message": "Redis connection is working"}
    except redis.RedisError as e:
        raise HTTPException(status_code=503, detail="Redis connection failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)