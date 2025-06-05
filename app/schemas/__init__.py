from pydantic import BaseModel

class ChatMessage(BaseModel):
    content: str
    # Add other fields as needed