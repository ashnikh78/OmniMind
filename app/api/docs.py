from fastapi.openapi.utils import get_openapi
from fastapi import FastAPI
from app.core.config import settings

def custom_openapi(app: FastAPI):
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="OmniMind AI Platform API",
        version=settings.API_VERSION,
        description="""
        OmniMind AI Platform API Documentation
        
        ## Features
        - Advanced AI Model Orchestration
        - Knowledge Engine Integration
        - Voice Processing Pipeline
        - Real-time Monitoring & Analytics
        - Compliance & Security Management
        
        ## Authentication
        All endpoints require JWT authentication. Include the token in the Authorization header:
        ```
        Authorization: Bearer <your_token>
        ```
        
        ## Rate Limiting
        API requests are rate-limited based on your subscription tier:
        - Free: 100 requests/hour
        - Pro: 1000 requests/hour
        - Enterprise: Custom limits
        
        ## Error Handling
        The API uses standard HTTP status codes and returns detailed error messages in JSON format.
        """,
        routes=app.routes,
    )

    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }

    # Add security requirement to all operations
    for path in openapi_schema["paths"].values():
        for operation in path.values():
            operation["security"] = [{"bearerAuth": []}]

    # Add tags for better organization
    openapi_schema["tags"] = [
        {
            "name": "Authentication",
            "description": "User authentication and authorization endpoints"
        },
        {
            "name": "AI Models",
            "description": "AI model management and inference endpoints"
        },
        {
            "name": "Knowledge Engine",
            "description": "Knowledge base management and query endpoints"
        },
        {
            "name": "Voice Processing",
            "description": "Voice processing and synthesis endpoints"
        },
        {
            "name": "Monitoring",
            "description": "System monitoring and metrics endpoints"
        },
        {
            "name": "Compliance",
            "description": "Compliance and moderation endpoints"
        },
        {
            "name": "Admin",
            "description": "Administrative endpoints"
        }
    ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema 