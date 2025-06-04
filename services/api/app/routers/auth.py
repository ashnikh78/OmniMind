from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from typing import Any, Optional
import logging
from app.models.user import UserCreate, UserResponse, Token
from app.services import auth_service
from app.dependencies import get_current_active_user, get_redis_client
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)

user_router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

async def create_test_user_if_needed(redis: Any, pwd_context: Any) -> Optional[dict]:
    """Helper function to create test user if in development environment"""
    if settings.ENVIRONMENT != "development":
        return None
        
    test_email = "test@example.com"
    test_password = "test123"
    
    existing_user = auth_service.get_user_by_email(redis, email=test_email)
    if existing_user:
        return existing_user
        
    test_user_data = {
        "email": test_email,
        "password": pwd_context.hash(test_password),
        "role": "admin"
    }
    
    try:
        return auth_service.create_db_user(
            redis_client=redis,
            user_create_data=test_user_data,
            pwd_context=pwd_context
        )
    except Exception as e:
        logger.error(f"Failed to create test user: {e}")
        return None

@user_router.post("", response_model=UserResponse, summary="Create a new user")
async def create_new_user(
    user: UserCreate, 
    request: Request, 
    redis: Any = Depends(get_redis_client)
):
    try:
        # Check if user already exists
        db_user = auth_service.get_user_by_email(redis, email=user.email)
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Hash the password before storing
        user_data = user.model_dump()
        user_data["password"] = request.app.state.pwd_context.hash(user_data["password"])
        
        # Create the user
        created_user_data = auth_service.create_db_user(
            redis_client=redis,
            user_create_data=user_data,
            pwd_context=request.app.state.pwd_context
        )
        return UserResponse(**created_user_data)
    except Exception as e:
        logger.error(f"Error creating user: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/login", response_model=Token, summary="User login")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    redis: Any = Depends(get_redis_client)
):
    try:
        # In development, ensure test user exists
        if settings.ENVIRONMENT == "development":
            await create_test_user_if_needed(redis, request.app.state.pwd_context)

        # Get user from database
        user = auth_service.get_user_by_email(redis, email=form_data.username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify password
        if not auth_service.verify_password(
            form_data.password, 
            user["hashed_password"], 
            request.app.state.pwd_context
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Create access token
        access_token = auth_service.create_access_token(
            data={"sub": user["id"], "email": user["email"], "role": user["role"]},
            settings=request.app.state.settings
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/create-test-user", summary="Create a test user (development only)", 
            status_code=status.HTTP_201_CREATED)
async def create_test_user_endpoint(
    request: Request, 
    redis: Any = Depends(get_redis_client)
):
    if settings.ENVIRONMENT != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test user creation only allowed in development environment"
        )
    
    try:
        test_email = "test@example.com"
        if auth_service.get_user_by_email(redis, email=test_email):
            return {"message": "Test user already exists"}
        
        test_user_data = {
            "email": test_email,
            "password": request.app.state.pwd_context.hash("test123"),
            "role": "admin"
        }
        auth_service.create_db_user(
            redis_client=redis,
            user_create_data=test_user_data,
            pwd_context=request.app.state.pwd_context
        )
        return {"message": "Test user created successfully"}
    except Exception as e:
        logger.error(f"Error creating test user: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/refresh", response_model=Token, summary="Refresh JWT token")
async def refresh_user_token(
    request: Request,
    current_user: dict = Depends(get_current_active_user),
    redis: Any = Depends(get_redis_client)
):
    try:
        user_id = current_user.get("id")
        email = current_user.get("email")
        role = current_user.get("role")

        if not all([user_id, email, role]):
            raise HTTPException(status_code=400, detail="Invalid user data in token")

        new_access_token = auth_service.create_access_token(
            data={"sub": user_id, "email": email, "role": role},
            settings=request.app.state.settings
        )
        return {"access_token": new_access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def read_users_me(current_user: dict = Depends(get_current_active_user)):
    try:
        return UserResponse(**current_user)
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")