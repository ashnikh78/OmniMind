from fastapi import FastAPI, Request, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import httpx
import redis
import json
import asyncio
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime, timedelta
import os
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import time
import jwt
from pydantic import BaseModel, EmailStr
import psutil
from passlib.context import CryptContext
from app.core.model_orchestrator import OllamaModel
import ollama
import torch
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db, Base
from config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# User model
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"

class User(BaseModel):
    id: str
    email: EmailStr
    role: str
    created_at: str

# Prometheus metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'])

app = FastAPI(
    title="OmniMind API Gateway",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware with proper configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Update Redis client initialization with better error handling
def init_redis_client(max_retries=3, retry_delay=1):
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
            # Test connection
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

# Initialize Redis client with retry logic
try:
    redis_client = init_redis_client()
except redis.RedisError as e:
    logger.error(f"Failed to initialize Redis client: {str(e)}")
    raise

# Initialize HTTP client
http_client = httpx.AsyncClient(timeout=30.0)

# User presence tracking
class UserPresence:
    def __init__(self):
        self.online_users: Dict[str, Dict] = {}
        self.user_activities: Dict[str, List[Dict]] = {}

    def user_connected(self, user_id: str, user_data: dict):
        self.online_users[user_id] = {
            **user_data,
            "last_seen": datetime.utcnow().isoformat(),
            "status": "online"
        }
        self._add_activity(user_id, "connected")

    def user_disconnected(self, user_id: str):
        if user_id in self.online_users:
            self.online_users[user_id]["status"] = "offline"
            self.online_users[user_id]["last_seen"] = datetime.utcnow().isoformat()
            self._add_activity(user_id, "disconnected")

    def update_user_status(self, user_id: str, status: str):
        if user_id in self.online_users:
            self.online_users[user_id]["status"] = status
            self.online_users[user_id]["last_seen"] = datetime.utcnow().isoformat()
            self._add_activity(user_id, f"status_changed_{status}")

    def _add_activity(self, user_id: str, activity: str):
        if user_id not in self.user_activities:
            self.user_activities[user_id] = []
        self.user_activities[user_id].append({
            "activity": activity,
            "timestamp": datetime.utcnow().isoformat()
        })
        # Keep only last 100 activities
        self.user_activities[user_id] = self.user_activities[user_id][-100:]

    def get_online_users(self):
        return self.online_users

    def get_user_activities(self, user_id: str, limit: int = 10):
        return self.user_activities.get(user_id, [])[-limit:]

user_presence = UserPresence()

# User authentication middleware with improved error handling
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("username")
        if username is None:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.user_connections: Dict[str, WebSocket] = {}
        self.user_data: Dict[str, dict] = {}
        self.connection_timestamps: Dict[str, float] = {}

    async def connect(self, websocket: WebSocket, client_id: str, user_data: dict):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        self.user_connections[client_id] = websocket
        self.user_data[client_id] = user_data
        self.connection_timestamps[client_id] = time.time()
        user_presence.user_connected(client_id, user_data)
        await self.broadcast_user_presence()

    def disconnect(self, websocket: WebSocket, client_id: str):
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

    async def broadcast_user_presence(self):
        await self.broadcast({
            "type": "presence",
            "data": user_presence.get_online_users()
        })

    async def broadcast(self, message: dict, exclude: Optional[str] = None):
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

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.user_connections:
            try:
                await self.user_connections[client_id].send_json(message)
            except WebSocketDisconnect:
                self.disconnect(self.user_connections[client_id], client_id)
            except Exception as e:
                logger.error(f"Error sending personal message to {client_id}: {str(e)}")
                self.disconnect(self.user_connections[client_id], client_id)

manager = ConnectionManager()

# Analytics metrics
class AnalyticsMetrics:
    def __init__(self):
        self.request_counts = REQUEST_COUNT  # Use global metric
        self.request_latency = REQUEST_LATENCY  # Use global metric
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

# Update rate limiting middleware to track metrics
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    current_minute = datetime.utcnow().strftime("%Y-%m-%d-%H-%M")
    key = f"rate_limit:{client_ip}:{current_minute}"
    
    try:
        # Get current count from Redis
        count = redis_client.get(key)
        if count is None:
            count = 0
        else:
            count = int(count)
        
        # Check if rate limit exceeded
        if count >= 100:  # 100 requests per minute
            analytics.error_count.labels(type='rate_limit').inc()
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"}
            )
        
        # Increment count
        redis_client.incr(key)
        redis_client.expire(key, 60)  # Expire after 1 minute
        
        # Process request
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        
        # Update metrics
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

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    return response

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Chat message model
class ChatMessage(BaseModel):
    sender_id: str
    sender_name: str
    content: str
    timestamp: str
    file: Optional[dict] = None

# Chat endpoints
@app.post("/api/chat/messages")
async def create_chat_message(message: ChatMessage):
    # Store message in Redis
    message_id = redis_client.incr("chat_message_counter")
    message_dict = message.dict()
    message_dict["id"] = message_id
    
    # Store message in Redis
    redis_client.set(f"chat_message:{message_id}", json.dumps(message_dict))
    redis_client.expire(f"chat_message:{message_id}", 86400)  # Expire after 24 hours
    
    # Add to recent messages list
    redis_client.lpush("recent_chat_messages", json.dumps(message_dict))
    redis_client.ltrim("recent_chat_messages", 0, 999)  # Keep last 1000 messages
    
    # Broadcast message to all connected clients
    await manager.broadcast({
        "type": "chat",
        "data": message_dict
    })
    
    # Update metrics
    analytics.chat_messages.inc()
    if message.file:
        analytics.file_uploads.labels(file_type=message.file.get("type", "unknown")).inc()
        redis_client.hincrby("file_uploads_by_type", message.file.get("type", "unknown"), 1)
    
    return message_dict

@app.get("/api/chat/history")
async def get_chat_history(limit: int = 50):
    messages = []
    for message_json in redis_client.lrange("recent_chat_messages", 0, limit - 1):
        messages.append(json.loads(message_json))
    return messages

@app.get("/api/chat/messages/{message_id}")
async def get_chat_message(message_id: int):
    message_json = redis_client.get(f"chat_message:{message_id}")
    if not message_json:
        raise HTTPException(status_code=404, detail="Message not found")
    return json.loads(message_json)

# WebSocket authentication
async def get_ws_user(token: str):
    try:
        payload = jwt.decode(
            token,
            os.getenv("JWT_SECRET", "your-secret-key"),
            algorithms=["HS256"]
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        # Get user data from Redis
        user_data = redis_client.get(f"user:{user_id}")
        if not user_data:
            return None
        
        return json.loads(user_data)
    except (jwt.InvalidTokenError, json.JSONDecodeError):
        return None

# Update WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    try:
        # Get token from query parameters
        token = websocket.query_params.get("token")
        if not token:
            logger.warning("WebSocket connection attempt without token")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Verify token
        user = await get_ws_user(token)
        if not user:
            logger.warning("WebSocket connection attempt with invalid token")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Connect with user data
        await manager.connect(websocket, client_id, {
            "id": user["id"],
            "email": user["email"],
            "name": user.get("name", "Unknown"),
            "role": user.get("role", "user")
        })

        try:
            while True:
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                    
                    # Handle heartbeat
                    if message.get("type") == "heartbeat":
                        await websocket.send_json({"type": "heartbeat"})
                        continue
                    
                    if message.get("type") == "chat":
                        # Handle chat message
                        chat_message = ChatMessage(**message["data"])
                        await create_chat_message(chat_message)
                    elif message.get("type") == "chat_typing":
                        # Handle typing status
                        await manager.broadcast({
                            "type": "chat_typing",
                            "data": {
                                "user_id": client_id,
                                "isTyping": message["data"]["isTyping"]
                            }
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
                except json.JSONDecodeError:
                    logger.error("Invalid JSON in WebSocket message")
                    await websocket.send_json({"error": "Invalid JSON"})
                except Exception as e:
                    logger.error(f"Error processing WebSocket message: {str(e)}")
                    await websocket.send_json({"error": "Internal server error"})
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {client_id}")
            manager.disconnect(websocket, client_id)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass

# User endpoints
@app.post("/api/v1/users", response_model=User)
async def create_user(user: UserCreate):
    # Check if user already exists
    if redis_client.exists(f"user:email:{user.email}"):
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Generate user ID
    user_id = str(redis_client.incr("user_counter"))
    
    # Hash password
    hashed_password = pwd_context.hash(user.password)
    
    # Create user object
    user_data = {
        "id": user_id,
        "email": user.email,
        "password": hashed_password,
        "role": user.role,
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Store user in Redis
    redis_client.set(f"user:{user_id}", json.dumps(user_data))
    redis_client.set(f"user:email:{user.email}", user_id)
    
    # Return user without password
    return {**user_data, "password": None}

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/v1/auth/login")
async def login(login_data: LoginRequest):
    try:
        logger.info(f"Login attempt for email: {login_data.email}")
        
        # Get user by email
        user_id = redis_client.get(f"user:email:{login_data.email}")
        if not user_id:
            # Create test user if it doesn't exist
            if login_data.email == "test@example.com":
                user_id = str(redis_client.incr("user_counter"))
                hashed_password = pwd_context.hash("test123")
                user_data = {
                    "id": user_id,
                    "email": login_data.email,
                    "password": hashed_password,
                    "role": "admin",
                    "created_at": datetime.utcnow().isoformat()
                }
                redis_client.set(f"user:{user_id}", json.dumps(user_data))
                redis_client.set(f"user:email:{login_data.email}", user_id)
            else:
                logger.warning(f"Login failed: User not found for email {login_data.email}")
                raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Get user data
        user_data = redis_client.get(f"user:{user_id}")
        if not user_data:
            logger.warning(f"Login failed: User data not found for ID {user_id}")
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user_data = json.loads(user_data)
        
        # Verify password
        if not pwd_context.verify(login_data.password, user_data["password"]):
            logger.warning(f"Login failed: Invalid password for user {user_id}")
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Generate JWT token
        token = jwt.encode(
            {
                "sub": user_id,
                "email": user_data["email"],
                "role": user_data["role"],
                "exp": datetime.utcnow() + timedelta(days=1)
            },
            os.getenv("JWT_SECRET", "your-secret-key"),
            algorithm="HS256"
        )
        
        logger.info(f"Login successful for user {user_id}")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": user_data["email"],
                "role": user_data["role"]
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Add a test user creation endpoint for development
@app.post("/api/v1/auth/create-test-user")
async def create_test_user():
    try:
        # Check if test user already exists
        test_email = "test@example.com"
        user_id = redis_client.get(f"user:email:{test_email}")
        
        if user_id:
            return {"message": "Test user already exists"}
        
        # Create test user
        user_id = str(redis_client.incr("user_counter"))
        hashed_password = pwd_context.hash("test123")
        
        user_data = {
            "id": user_id,
            "email": test_email,
            "password": hashed_password,
            "role": "admin",
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Store user in Redis
        redis_client.set(f"user:{user_id}", json.dumps(user_data))
        redis_client.set(f"user:email:{test_email}", user_id)
        
        return {"message": "Test user created successfully"}
    except Exception as e:
        logger.error(f"Error creating test user: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create test user")

@app.post("/api/v1/auth/refresh")
async def refresh_token(request: Request):
    try:
        data = await request.json()
        token = data.get("token")
        if not token:
            raise HTTPException(status_code=400, detail="Token is required")
        
        # Decode the token
        try:
            payload = jwt.decode(token, os.getenv("JWT_SECRET", "your-secret-key"), algorithms=["HS256"])
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Get user data
        user_data = redis_client.get(f"user:{user_id}")
        if not user_data:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_data = json.loads(user_data)
        
        # Generate new token
        new_token = jwt.encode(
            {
                "sub": user_id,
                "email": user_data["email"],
                "role": user_data["role"],
                "exp": datetime.utcnow() + timedelta(days=1)
            },
            os.getenv("JWT_SECRET", "your-secret-key"),
            algorithm="HS256"
        )
        
        return {
            "access_token": new_token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": user_data["email"],
                "role": user_data["role"]
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Move auth endpoints before proxy routes
@app.get("/api/v1/auth/me")
async def get_current_user_profile(request: Request):
    try:
        # Get the authorization header
        auth_header = request.headers.get('Authorization')
        logger.info(f"Auth header: {auth_header}")
        
        if not auth_header or not auth_header.startswith('Bearer '):
            logger.warning("No valid auth header found")
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        # Extract the token
        token = auth_header.split(' ')[1]
        logger.debug(f"Token: {token[:10]}...")
        
        # Decode the token
        try:
            payload = jwt.decode(
                token,
                os.getenv("JWT_SECRET", "your-secret-key"),
                algorithms=["HS256"]
            )
            logger.debug(f"Decoded payload: {payload}")
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {str(e)}")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user ID from token
        user_id = payload.get("sub")
        if not user_id:
            logger.warning("No user_id in token payload")
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Get user data from Redis
        user_data = redis_client.get(f"user:{user_id}")
        if not user_data:
            logger.warning(f"No user data found for user_id: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Parse user data and remove sensitive information
        user = json.loads(user_data)
        user.pop("password", None)
        
        # Add additional profile information
        profile = {
            **user,
            "preferences": {
                "theme": "light",
                "notifications": {
                    "email": True,
                    "push": True,
                    "desktop": True
                },
                "language": "en",
                "timezone": "UTC"
            },
            "stats": {
                "lastLogin": datetime.utcnow().isoformat(),
                "loginCount": 1,
                "documentCount": 0,
                "messageCount": 0
            },
            "roles": [user.get("role", "user")],
            "permissions": ["read", "write"] if user.get("role") == "admin" else ["read"]
        }
        
        logger.info(f"Successfully retrieved profile for user {user_id}")
        return profile
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in get_current_user_profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Document models
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

# Document endpoints
@app.post("/api/documents")
async def create_document(document: Document):
    # Store document in Redis
    document_id = redis_client.incr("document_counter")
    document_dict = document.dict()
    document_dict["id"] = str(document_id)
    
    # Store document in Redis
    redis_client.set(f"document:{document_id}", json.dumps(document_dict))
    
    # Add to user's documents list
    redis_client.sadd(f"user_documents:{document.owner_id}", document_id)
    
    # Initialize document history
    redis_client.lpush(f"document_history:{document_id}", json.dumps({
        "type": "create",
        "user_id": document.owner_id,
        "timestamp": document.created_at
    }))
    
    return document_dict

@app.get("/api/documents/{document_id}")
async def get_document(document_id: str):
    document_json = redis_client.get(f"document:{document_id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    return json.loads(document_json)

@app.get("/api/documents/current")
async def get_current_document():
    # Get the most recently accessed document for the current user
    document_id = redis_client.get(f"user_current_document:{user.id}")
    if not document_id:
        raise HTTPException(status_code=404, detail="No current document")
    return await get_document(document_id)

@app.post("/api/documents/save")
async def save_document(document: Document):
    document_json = redis_client.get(f"document:{document.id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update document
    document_dict = document.dict()
    redis_client.set(f"document:{document.id}", json.dumps(document_dict))
    
    # Add to history
    redis_client.lpush(f"document_history:{document.id}", json.dumps({
        "type": "update",
        "user_id": document.owner_id,
        "timestamp": document.updated_at
    }))
    
    # Broadcast update to all collaborators
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

@app.get("/api/documents/{document_id}/history")
async def get_document_history(document_id: str, limit: int = 50):
    history = []
    for entry_json in redis_client.lrange(f"document_history:{document_id}", 0, limit - 1):
        history.append(json.loads(entry_json))
    return history

@app.post("/api/documents/collaborators")
async def add_collaborator(document_id: str, collaborator: dict):
    document_json = redis_client.get(f"document:{document_id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = json.loads(document_json)
    if collaborator["id"] not in [c["id"] for c in document["collaborators"]]:
        document["collaborators"].append(collaborator)
        redis_client.set(f"document:{document_id}", json.dumps(document))
        
        # Add to history
        redis_client.lpush(f"document_history:{document_id}", json.dumps({
            "type": "add_collaborator",
            "user_id": user.id,
            "collaborator_id": collaborator["id"],
            "timestamp": datetime.utcnow().isoformat()
        }))
        
        # Notify new collaborator
        await manager.send_personal_message({
            "type": "document_invite",
            "data": {
                "document_id": document_id,
                "document_title": document["title"],
                "inviter_id": user.id
            }
        }, collaborator["id"])
    
    return collaborator

@app.delete("/api/documents/collaborators/{document_id}/{collaborator_id}")
async def remove_collaborator(document_id: str, collaborator_id: str):
    document_json = redis_client.get(f"document:{document_id}")
    if not document_json:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document = json.loads(document_json)
    document["collaborators"] = [c for c in document["collaborators"] if c["id"] != collaborator_id]
    redis_client.set(f"document:{document_id}", json.dumps(document))
    
    # Add to history
    redis_client.lpush(f"document_history:{document_id}", json.dumps({
        "type": "remove_collaborator",
        "user_id": user.id,
        "collaborator_id": collaborator_id,
        "timestamp": datetime.utcnow().isoformat()
    }))
    
    # Notify removed collaborator
    await manager.send_personal_message({
        "type": "document_removed",
        "data": {
            "document_id": document_id,
            "document_title": document["title"]
        }
    }, collaborator_id)
    
    return {"status": "success"}

# Add metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Add this function before get_current_user
async def get_user_by_id(user_id: str):
    try:
        # Try to get user from Redis first
        user_data = redis_client.get(f"user:{user_id}")
        if user_data:
            return json.loads(user_data)
        
        # If not in Redis, try to get from database
        # For now, we'll just return None since we're using Redis as our primary storage
        return None
    except Exception as e:
        print(f"Error in get_user_by_id: {str(e)}")
        return None

# Initialize start time
start_time = time.time()

# Add Redis health check endpoint
@app.get("/api/health/redis")
async def redis_health_check():
    try:
        redis_client.ping()
        return {"status": "healthy", "message": "Redis connection is working"}
    except redis.RedisError as e:
        logger.error(f"Redis health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Redis connection failed")

# Add root route
@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "OmniMind API Gateway is running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "metrics": "/metrics",
            "api": "/api",
            "auth": "/api/v1/auth"
        }
    }

# Ollama model manager
model_manager = {}

async def get_or_create_model(model_name: str) -> OllamaModel:
    if model_name not in model_manager:
        model_manager[model_name] = OllamaModel(model_name)
        await model_manager[model_name].warm_up()
    return model_manager[model_name]

@app.get("/api/ollama/models")
async def get_available_models():
    try:
        client = ollama.Client(host=settings.OLLAMA_HOST)
        models = await client.list()
        return models.get("models", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ollama/chat")
async def chat_with_model(request: Dict[str, Any]):
    try:
        model_name = request.get("model", "llama2")
        message = request.get("content", "")
        settings = request.get("settings", {})

        model = await get_or_create_model(model_name)
        
        # Generate response
        response = await model.generate(
            prompt=message,
            temperature=settings.get("temperature", 0.7),
            max_tokens=settings.get("maxTokens", 2048),
            top_p=settings.get("topP", 0.9)
        )

        if response.get("error"):
            raise HTTPException(status_code=500, detail=response.get("error_message"))

        # Create chat message
        chat_message = {
            "sender_id": "ai",
            "sender_name": f"{model_name.capitalize()} AI",
            "content": response["response"],
            "timestamp": datetime.utcnow().isoformat(),
            "model": model_name,
            "settings": settings,
            "metrics": {
                "latency": response["latency"],
                "gpu_memory": response.get("gpu_memory", 0)
            }
        }

        # Store message in Redis
        message_id = redis_client.incr("chat_message_counter")
        chat_message["id"] = message_id
        redis_client.set(f"chat_message:{message_id}", json.dumps(chat_message))
        redis_client.expire(f"chat_message:{message_id}", 86400)  # Expire after 24 hours
        
        # Add to recent messages list
        redis_client.lpush("recent_chat_messages", json.dumps(chat_message))
        redis_client.ltrim("recent_chat_messages", 0, 999)  # Keep last 1000 messages

        # Broadcast message
        await manager.broadcast({
            "type": "chat",
            "data": chat_message
        })

        return chat_message

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ollama/models/{model_name}/pull")
async def pull_model(model_name: str):
    try:
        client = ollama.Client(host=settings.OLLAMA_HOST)
        await client.pull(model_name)
        return {"status": "success", "message": f"Model {model_name} pulled successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/ollama/models/{model_name}")
async def delete_model(model_name: str):
    try:
        client = ollama.Client(host=settings.OLLAMA_HOST)
        await client.delete(model_name)
        if model_name in model_manager:
            model_manager[model_name].unload()
            del model_manager[model_name]
        return {"status": "success", "message": f"Model {model_name} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ollama/models/{model_name}/status")
async def get_model_status(model_name: str):
    try:
        model = await get_or_create_model(model_name)
        return {
            "name": model_name,
            "loaded": model._loaded,
            "last_used": model._last_used,
            "concurrent_requests": model._concurrent_requests,
            "gpu_enabled": model._gpu_enabled,
            "gpu_memory": torch.cuda.memory_allocated() if model._gpu_enabled else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add missing endpoints
@app.get("/api/v1/ml/models")
async def get_ml_models():
    try:
        return [
            {
                "id": "model-1",
                "name": "GPT-4",
                "status": "active",
                "description": "Advanced language model for text generation and analysis",
                "capabilities": ["text-generation", "code-completion", "translation"],
                "metrics": {
                    "accuracy": 0.95,
                    "latency": 0.5,
                    "throughput": 100
                }
            },
            {
                "id": "model-2",
                "name": "DALL-E 3",
                "status": "active",
                "description": "Image generation model",
                "capabilities": ["image-generation", "image-editing"],
                "metrics": {
                    "quality_score": 0.92,
                    "generation_time": 2.5,
                    "success_rate": 0.98
                }
            },
            {
                "id": "model-3",
                "name": "Whisper",
                "status": "active",
                "description": "Speech recognition model",
                "capabilities": ["speech-to-text", "transcription"],
                "metrics": {
                    "accuracy": 0.94,
                    "processing_time": 1.2,
                    "language_support": 50
                }
            }
        ]
    except Exception as e:
        logger.error(f"Error in get_ml_models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve ML models")

@app.get("/api/v1/ml/models/{model_id}")
async def get_ml_model(model_id: str):
    try:
        # Mock data for a single model
        model = {
            "id": model_id,
            "name": "GPT-4",
            "status": "active",
            "description": "Advanced language model for text generation and analysis",
            "capabilities": ["text-generation", "code-completion", "translation"],
            "metrics": {
                "accuracy": 0.95,
                "latency": 0.5,
                "throughput": 100
            },
            "config": {
                "max_tokens": 2048,
                "temperature": 0.7,
                "top_p": 0.9
            }
        }
        return model
    except Exception as e:
        logger.error(f"Error in get_ml_model: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve ML model")

@app.get("/api/v1/ml/models/{model_id}/metrics")
async def get_ml_model_metrics(model_id: str):
    try:
        # Return stable mock data with all required fields
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
                "latency": 0.5
            },
            "errors": {
                "count": 50,
                "types": {
                    "timeout": 20,
                    "validation": 15,
                    "other": 15
                }
            }
        }
    except Exception as e:
        logger.error(f"Error in get_ml_model_metrics: {str(e)}")
        # Return a default response instead of raising an error
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
                "latency": 0
            },
            "errors": {
                "count": 0,
                "types": {}
            }
        }

# --- CATCH-ALL PROXY ROUTES ---

@app.get("/api/{path:path}")
async def proxy_get(path: str, request: Request):
    try:
        # Handle Ollama endpoints directly
        if path.startswith("ollama/"):
            target_url = f"{settings.OLLAMA_HOST}/api/{path.replace('ollama/', '')}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(target_url)
                return JSONResponse(content=response.json(), status_code=response.status_code)
        # Handle other API endpoints
        target_url = f"http://{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(target_url)
            return JSONResponse(content=response.json(), status_code=response.status_code)
    except httpx.RequestError as e:
        logger.error(f"Proxy request error: {str(e)}")
        raise HTTPException(status_code=502, detail="Bad Gateway")
    except Exception as e:
        logger.error(f"Unexpected error in proxy: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.post("/api/{path:path}")
async def proxy_post(path: str, request: Request):
    try:
        # Handle Ollama endpoints directly
        if path.startswith("ollama/"):
            target_url = f"{settings.OLLAMA_HOST}/api/{path.replace('ollama/', '')}"
            body = await request.json()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(target_url, json=body)
                return JSONResponse(content=response.json(), status_code=response.status_code)
        # Handle other API endpoints
        target_url = f"http://{path}"
        body = await request.json()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(target_url, json=body)
            return JSONResponse(content=response.json(), status_code=response.status_code)
    except httpx.RequestError as e:
        logger.error(f"Proxy request error: {str(e)}")
        raise HTTPException(status_code=502, detail="Bad Gateway")
    except Exception as e:
        logger.error(f"Unexpected error in proxy: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.delete("/api/{path:path}")
async def proxy_delete(path: str, request: Request):
    # Skip proxy for auth endpoints
    if path.startswith("v1/auth/"):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        target_url = f"http://{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(target_url)
            return JSONResponse(content=response.json(), status_code=response.status_code)
    except httpx.RequestError as e:
        logger.error(f"Proxy request error: {str(e)}")
        raise HTTPException(status_code=502, detail="Bad Gateway")
    except Exception as e:
        logger.error(f"Unexpected error in proxy: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# Real-time event endpoints
@app.post("/api/events")
async def create_event(event: dict):
    # Store event in Redis
    event_id = redis_client.incr("event_counter")
    event["id"] = event_id
    event["timestamp"] = datetime.utcnow().isoformat()
    
    # Store event in Redis
    redis_client.set(f"event:{event_id}", json.dumps(event))
    redis_client.expire(f"event:{event_id}", 86400)  # Expire after 24 hours
    
    # Add to recent events list
    redis_client.lpush("recent_events", json.dumps(event))
    redis_client.ltrim("recent_events", 0, 99)  # Keep only last 100 events
    
    # Broadcast event to all connected clients
    await manager.broadcast({
        "type": "event",
        "data": event
    })
    
    return event

@app.get("/api/events")
async def get_events(limit: int = 10):
    events = []
    for event_json in redis_client.lrange("recent_events", 0, limit - 1):
        events.append(json.loads(event_json))
    return events

@app.get("/api/events/{event_id}")
async def get_event(event_id: int):
    event_json = redis_client.get(f"event:{event_id}")
    if not event_json:
        raise HTTPException(status_code=404, detail="Event not found")
    return json.loads(event_json)

# System metrics endpoint
@app.get("/api/metrics")
async def get_metrics():
    metrics = {
        "active_connections": len(manager.user_connections),
        "total_events": int(redis_client.get("event_counter") or 0),
        "recent_events_count": redis_client.llen("recent_events"),
        "redis_memory_used": redis_client.info()["used_memory_human"],
        "uptime": time.time() - start_time
    }
    return metrics

# Add new endpoints for user presence
@app.get("/api/presence")
async def get_presence():
    return user_presence.get_online_users()

@app.get("/api/presence/{user_id}/activities")
async def get_user_activities(user_id: str, limit: int = 10):
    return user_presence.get_user_activities(user_id, limit)

# Add real-time analytics endpoints
@app.get("/api/analytics/realtime")
async def get_realtime_analytics():
    try:
        metrics = {
            "active_users": len(manager.user_connections),
            "total_connections": sum(len(conns) for conns in manager.active_connections.values()),
            "user_roles": {},
            "recent_activities": [],
            "system_metrics": {
                "cpu_usage": psutil.Process().cpu_percent(),
                "memory_usage": psutil.Process().memory_info().rss,
                "uptime": time.time() - start_time
            }
        }

        # Count users by role
        for user_data in manager.user_data.values():
            role = user_data.get("role", "unknown")
            metrics["user_roles"][role] = metrics["user_roles"].get(role, 0) + 1

        # Get recent activities
        for user_id, activities in user_presence.user_activities.items():
            metrics["recent_activities"].extend(activities[-5:])  # Last 5 activities per user

        # Sort activities by timestamp
        metrics["recent_activities"].sort(key=lambda x: x["timestamp"], reverse=True)
        metrics["recent_activities"] = metrics["recent_activities"][:20]  # Keep last 20 activities

        # Add Redis metrics
        try:
            redis_info = redis_client.info()
            metrics["redis"] = {
                "connected_clients": redis_info.get("connected_clients", 0),
                "used_memory": redis_info.get("used_memory_human", "0"),
                "total_connections_received": redis_info.get("total_connections_received", 0)
            }
        except redis.RedisError as e:
            logger.error(f"Error getting Redis metrics: {str(e)}")
            metrics["redis"] = {
                "error": "Failed to get Redis metrics"
            }

        return metrics
    except Exception as e:
        logger.error(f"Error in get_realtime_analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Enhanced analytics endpoint
@app.get("/api/analytics/enhanced")
async def get_enhanced_analytics():
    try:
        metrics = {
            "system": {
                "active_connections": len(manager.user_connections),
                "total_events": int(redis_client.get("event_counter") or 0),
                "recent_events_count": redis_client.llen("recent_events"),
                "redis_memory_used": redis_client.info().get("used_memory_human", "0"),
                "uptime": time.time() - start_time,
                "memory_usage": psutil.Process().memory_info().rss,
                "cpu_usage": psutil.Process().cpu_percent(),
            },
            "users": {
                "active_users": len(manager.user_connections),
                "user_roles": {},
                "user_status": {
                    "online": 0,
                    "away": 0,
                    "busy": 0,
                    "offline": 0
                },
                "recent_activities": []
            },
            "chat": {
                "total_messages": int(redis_client.get("chat_message_counter") or 0),
                "messages_last_hour": redis_client.llen("recent_chat_messages"),
                "active_chats": len(set(msg["sender_id"] for msg in json.loads(redis_client.lrange("recent_chat_messages", 0, -1)))),
                "file_uploads": {
                    "total": int(redis_client.get("file_upload_counter") or 0),
                    "by_type": {}
                }
            },
            "performance": {
                "request_counts": {
                    "total": analytics.request_counts._value.get(),
                    "by_endpoint": {},
                    "by_status": {}
                },
                "latency": {
                    "average": analytics.request_latency._sum.get() / analytics.request_latency._count.get() if analytics.request_latency._count.get() > 0 else 0,
                    "p95": analytics.request_latency.observe(0.95),
                    "p99": analytics.request_latency.observe(0.99)
                },
                "errors": {
                    "total": analytics.error_count._value.get(),
                    "by_type": {}
                }
            }
        }

        # Count users by role and status
        for user_data in manager.user_data.values():
            role = user_data.get("role", "unknown")
            metrics["users"]["user_roles"][role] = metrics["users"]["user_roles"].get(role, 0) + 1
            
            status = user_presence.online_users.get(user_data["id"], {}).get("status", "offline")
            metrics["users"]["user_status"][status] = metrics["users"]["user_status"].get(status, 0) + 1

        # Get recent activities
        for user_id, activities in user_presence.user_activities.items():
            metrics["users"]["recent_activities"].extend(activities[-5:])

        # Sort activities by timestamp
        metrics["users"]["recent_activities"].sort(key=lambda x: x["timestamp"], reverse=True)
        metrics["users"]["recent_activities"] = metrics["users"]["recent_activities"][:20]

        # Get file upload statistics
        file_types = redis_client.hgetall("file_uploads_by_type")
        metrics["chat"]["file_uploads"]["by_type"] = {
            k: int(v) for k, v in file_types.items()
        }

        return metrics
    except Exception as e:
        logger.error(f"Error in get_enhanced_analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 