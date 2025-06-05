from fastapi import Request
from app.config import settings

async def add_security_headers(request: Request, call_next):
    """Add security headers to HTTP responses."""
    response = await call_next(request)
    for header, value in settings.SECURITY_HEADERS.items():
        response.headers[header] = value
    return response