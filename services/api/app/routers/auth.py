from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm # For form data in login
from typing import Any

from app.models.user import UserCreate, UserResponse, LoginRequest, Token
from app.services import auth_service
from app.dependencies import get_current_active_user, get_redis_client

# Placeholders for objects that will be initialized in main.py and passed or made available
# For now, auth_service uses its own placeholders for settings and pwd_context.
# This will be refined during integration.

router = APIRouter(
    prefix="/api/v1/auth",  # Consistent with original paths like /api/v1/auth/login
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)

user_router = APIRouter(
    prefix="/api/v1/users", # For user creation, separate from /auth
    tags=["auth"], # Still tagged as auth as it's user creation related to auth
    responses={404: {"description": "Not found"}},
)


@user_router.post("", response_model=UserResponse, summary="Create a new user")
async def create_new_user(user: UserCreate, request: Request, redis: Any = Depends(get_redis_client)):
    db_user = auth_service.get_user_by_email(redis, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    created_user_data = auth_service.create_db_user(
        redis_client=redis,
        user_create_data=user.model_dump(),
        pwd_context=request.app.state.pwd_context
    )
    return UserResponse(**created_user_data)


@router.post("/login", response_model=Token, summary="User login")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    redis: Any = Depends(get_redis_client)
):
    # Using email from form_data.username as is common
    user = auth_service.get_user_by_email(redis, email=form_data.username)
    if not user or not auth_service.verify_password(form_data.password, user["hashed_password"], request.app.state.pwd_context):
        # Special handling for test@example.com as in original main.py
        if form_data.username == "test@example.com" and form_data.password == "test123":
            if not user: # If test user doesn't exist, create it
                test_user_data = {
                    "email": "test@example.com",
                    "password": "test123", # Will be hashed by create_db_user
                    "role": "admin"
                }
                auth_service.create_db_user(redis, test_user_data, request.app.state.pwd_context)
                user = auth_service.get_user_by_email(redis, email=form_data.username) # Re-fetch
            # If user exists now (either pre-existing or just created)
            if user and auth_service.verify_password(form_data.password, user["hashed_password"], request.app.state.pwd_context):
                pass # Proceed to token creation
            else:
                 raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

    access_token = auth_service.create_access_token(
        data={"sub": user["id"], "email": user["email"], "role": user["role"]},
        settings=request.app.state.settings
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/create-test-user", summary="Create a test user", status_code=status.HTTP_201_CREATED)
async def create_test_user_endpoint(request: Request, redis: Any = Depends(get_redis_client)):
    test_email = "test@example.com"
    if auth_service.get_user_by_email(redis, email=test_email):
        return {"message": "Test user already exists"}
    
    test_user_data = {
        "email": test_email,
        "password": "test123", # Will be hashed by create_db_user
        "role": "admin"
    }
    auth_service.create_db_user(redis, test_user_data, request.app.state.pwd_context)
    return {"message": "Test user created successfully"}


@router.post("/refresh", response_model=Token, summary="Refresh JWT token")
async def refresh_user_token(
    request: Request, # To get current token from body
    current_user: dict = Depends(get_current_active_user), # Ensures old token is valid
    redis: Any = Depends(get_redis_client) # To fetch user details if needed
):
    # The get_current_active_user dependency already validates the token and returns user payload
    # We just need to issue a new token for this user.
    # The original code re-decoded the token from request body, which is redundant if get_current_user works.
    # However, if the intent is to refresh *any* valid token passed in body, not necessarily the one in Auth header:
    
    # For now, let's assume the refresh is for the currently authenticated user via Bearer token.
    # If a different token needs to be refreshed (passed in body), the logic would be different.
    # The original code in main.py took a token from request.json()
    # Let's stick to refreshing the token of the user identified by `current_user` from Bearer.

    user_id = current_user.get("id")
    email = current_user.get("email")
    role = current_user.get("role")

    if not all([user_id, email, role]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User details not found in token")

    new_access_token = auth_service.create_access_token(
        data={"sub": user_id, "email": email, "role": role},
        settings=request.app.state.settings
    )
    return {"access_token": new_access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def read_users_me(current_user: dict = Depends(get_current_active_user)):
    # current_user from get_current_active_user already contains necessary details
    # We need to ensure it matches the UserResponse model.
    # The 'password' field should not be there. 'hashed_password' is in DB model.
    # 'created_at' might be missing from token, needs to be fetched if required by UserResponse.
    # For now, assuming the token or get_user_by_id in get_current_user provides enough.
    # Let's refine UserResponse or what get_current_user returns.
    # The UserResponse model expects 'id', 'email', 'role', 'created_at'.
    # current_user from token has 'id' (sub), 'email', 'role'.
    # We need 'created_at'. Let's assume get_current_user (via get_user_by_id) provides it.
    
    # The current_user from get_current_user (which calls get_user_by_id) should have 'created_at'.
    # And it should not have 'hashed_password'.
    return UserResponse(**current_user)