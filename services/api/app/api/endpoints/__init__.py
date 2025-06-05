# services/api/app/api/endpoints/__init__.py

from .health import router as health_router
from .chat import router as chat_router

__all__ = ["health_router", "chat_router"]