from pydantic import BaseModel
from typing import List

class Collaborator(BaseModel):
    id: str
    email: str
    role: str = "editor"

class Document(BaseModel):
    id: str
    title: str
    content: str
    owner_id: str
    created_at: str
    updated_at: str
    collaborators: List[dict]

class ChatMessage(BaseModel):
    sender_id: str
    sender_name: str
    content: str
    timestamp: str