from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import time
from typing import Dict, Any, Optional
from app.core.model_orchestrator import ModelOrchestrator, QueryAnalysis
from app.core.knowledge_fusion import KnowledgeFusionEngine
from app.core.voice_pipeline import VoiceProcessingPipeline
from app.core.compliance import compliance_guard
from app.core.monitoring import performance_monitor, health_check, alert_manager
from app.core.rate_limiter import rate_limit_manager
from app.core.config import settings
from app.core.voice import VoiceInterface
from app.core.chat import ChatInterface
import logging
import os
import shutil
from app.api.routes import documentation

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.monitoring.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OmniMind AI Platform",
    description="Enterprise-grade AI platform with advanced features",
    version=settings.API_VERSION
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documentation.router)

# Initialize components
model_orchestrator = ModelOrchestrator()
knowledge_engine = KnowledgeFusionEngine()
voice_pipeline = VoiceProcessingPipeline()
voice = VoiceInterface()
chat = ChatInterface()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    start_time = time.time()
    
    # Check rate limits
    client_ip = request.client.host
    if not await rate_limit_manager.check_rate_limit("api", client_ip):
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests"}
        )
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Record metrics
        performance_monitor.track_model_performance(
            "api",
            process_time
        )
        
        return response
    except Exception as e:
        # Record failure
        await rate_limit_manager.record_failure("api", client_ip)
        raise

@app.get("/health")
async def health_check_endpoint():
    health_status = await health_check.check_health()
    return health_status

@app.post("/api/chat")
async def chat_endpoint(
    request: Request,
    data: Dict[str, Any]
):
    client_ip = request.client.host
    
    # Rate limiting
    if not await rate_limit_manager.check_rate_limit("user", client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")
    
    # Circuit breaker check
    if not await rate_limit_manager.check_circuit_breaker("model", "chat"):
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
    
    try:
        # Compliance check
        compliance_result = await compliance_guard.validate_compliance(
            data["message"],
            data.get("user_context", {})
        )
        
        if not compliance_result["content_moderation"]["is_safe"]:
            raise HTTPException(
                status_code=400,
                detail="Content violates moderation policy"
            )
        
        # Process query
        query_analysis = QueryAnalysis(
            urgency=data.get("urgency", "normal"),
            complexity=data.get("complexity", 0.5),
            context=data.get("context", {}),
            user_profile=data.get("user_profile"),
            session_id=data.get("session_id")
        )
        
        # Get knowledge context
        knowledge_results = await knowledge_engine.retrieve(
            data["message"],
            data.get("user_context", {})
        )
        
        # Generate response
        response = await model_orchestrator.generate_response(
            data["message"],
            query_analysis
        )
        
        # Record success
        await rate_limit_manager.record_success("model", "chat")
        
        # Audit the interaction
        await compliance_guard.audit_interaction(
            action="chat",
            user_id=data.get("user_id", "anonymous"),
            model_used=query_analysis.model_name,
            input_data=data["message"],
            output_data=response,
            compliance_checks=compliance_result,
            metadata={
                "ip": client_ip,
                "user_agent": request.headers.get("user-agent"),
                "knowledge_results": len(knowledge_results)
            }
        )
        
        return {
            "response": response,
            "knowledge_context": [
                result.dict() for result in knowledge_results[:3]
            ],
            "compliance": compliance_result
        }
    
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        await rate_limit_manager.record_failure("model", "chat")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voice")
async def voice_endpoint(
    request: Request,
    audio_data: bytes
):
    client_ip = request.client.host
    
    # Rate limiting
    if not await rate_limit_manager.check_rate_limit("user", client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")
    
    try:
        # Process voice
        text = await voice_pipeline.process_audio(audio_data)
        
        # Get chat response
        response = await chat_endpoint(request, {"message": text})
        
        # Convert response to speech
        audio_response = await voice_pipeline.text_to_speech(response["response"])
        
        return {
            "audio": audio_response,
            "text": response["response"],
            "compliance": response["compliance"]
        }
    
    except Exception as e:
        logger.error(f"Error in voice endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def metrics_endpoint():
    return {
        "rate_limits": {
            "api": await rate_limit_manager.get_remaining_requests("api", "global"),
            "model": await rate_limit_manager.get_remaining_requests("model", "global"),
            "user": await rate_limit_manager.get_remaining_requests("user", "global")
        },
        "health": await health_check.check_health(),
        "alerts": alert_manager.alert_history[-10:]  # Last 10 alerts
    }

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/voice-chat/")
async def voice_chat(audio: UploadFile = File(...), tone: str = "neutral"):
    # Save uploaded audio
    audio_path = f"temp_{audio.filename}"
    with open(audio_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)
    # Recognize speech
    user_text = voice.recognize(audio_path)
    # Chat response
    chat_result = chat.chat(user_text, tone=tone)
    # Synthesize response
    bot_audio_path = "static/bot_reply.wav"
    voice.speak(chat_result["response"], lang=chat_result["language"], output_path=bot_audio_path)
    return {
        "user_text": user_text,
        "bot_text": chat_result["response"],
        "sentiment": chat_result["sentiment"],
        "bot_audio_path": bot_audio_path
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    ) 