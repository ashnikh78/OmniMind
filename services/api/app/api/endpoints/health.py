# services/api/app/api/endpoints/health.py

from fastapi import APIRouter

router = APIRouter()

@router.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy"}