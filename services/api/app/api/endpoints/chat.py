# services/api/app/api/endpoints/chat.py
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import json
from redis import Redis
from pydantic import BaseModel

# Corrected imports using absolute paths
from app.dependencies import get_redis_client, get_current_active_user
from app.schemas.user import User  # Specific import for User
from app.schemas.chat import ChatMessage  # Specific import for ChatMessage

router = APIRouter()

class MessageResponse(BaseModel):
    status: str
    message: dict

@router.post("/chat/messages", response_model=MessageResponse, tags=["chat"])
async def send_message(
    message: ChatMessage,
    redis: Redis = Depends(get_redis_client),
    current_user: User = Depends(get_current_active_user)
) -> MessageResponse:
    """Send a new chat message"""
    
    # Validate sender matches authenticated user
    if message.sender_id != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sender ID must match authenticated user"
        )

    # Ensure valid timestamp
    try:
        datetime.fromisoformat(message.timestamp)
    except (ValueError, AttributeError):
        message.timestamp = datetime.utcnow().isoformat()

    # Store message in Redis
    message_dict = message.dict()
    redis.lpush("chat_messages", json.dumps(message_dict))
    
    return {
        "status": "message sent",
        "message": message_dict
    }