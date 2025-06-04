from pydantic import BaseModel
from typing import Optional, List

class Collaborator(BaseModel):
    id: str
    email: str
    role: str = "editor"

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