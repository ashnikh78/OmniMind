# services/api/app/dependencies/__init__.py

from .auth import get_current_active_user
from .redis import get_redis_client

__all__ = ["get_current_active_user", "get_redis_client"]