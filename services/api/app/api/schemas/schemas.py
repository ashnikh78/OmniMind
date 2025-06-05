# services/api/app/api/schemas/schemas.py

from pydantic import BaseModel

class ChatMessage(BaseModel):
    sender_id: str
    sender_name: str
    content: str
    timestamp: str