# app/schemas/chat.py
from pydantic import BaseModel
from datetime import datetime

class ChatMessage(BaseModel):
    content: str
    sender_id: str
    timestamp: str = datetime.utcnow().isoformat()
    # other fields as needed