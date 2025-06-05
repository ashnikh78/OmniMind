from pydantic import BaseModel

class User(BaseModel):
    username: str
    email: str | None = None
    disabled: bool = False
    is_active: bool = True