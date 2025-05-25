import pytest
from datetime import datetime, timedelta
from app.core.security import SecurityGuard, User, Token, TokenData
from fastapi import HTTPException

@pytest.fixture
def security_guard():
    return SecurityGuard()

@pytest.fixture
def test_user():
    return User(
        username="testuser",
        email="test@example.com",
        full_name="Test User",
        scopes=["read", "write"]
    )

def test_create_access_token(security_guard, test_user):
    data = {"sub": test_user.username, "scopes": test_user.scopes}
    token = security_guard.create_access_token(data)
    
    assert isinstance(token, Token)
    assert token.token_type == "bearer"
    assert token.refresh_token is not None
    assert token.expires_at > datetime.utcnow()

def test_verify_token(security_guard, test_user):
    data = {"sub": test_user.username, "scopes": test_user.scopes}
    token = security_guard.create_access_token(data)
    
    token_data = security_guard.verify_token(token.access_token)
    assert isinstance(token_data, TokenData)
    assert token_data.username == test_user.username
    assert token_data.scopes == test_user.scopes

def test_verify_expired_token(security_guard, test_user):
    data = {"sub": test_user.username, "scopes": test_user.scopes, "exp": datetime.utcnow() - timedelta(minutes=1)}
    expired_token = security_guard.create_access_token(data)
    
    with pytest.raises(HTTPException) as exc_info:
        security_guard.verify_token(expired_token.access_token)
    assert exc_info.value.status_code == 401
    assert "Token has expired" in str(exc_info.value.detail)

def test_verify_invalid_token(security_guard):
    with pytest.raises(HTTPException) as exc_info:
        security_guard.verify_token("invalid_token")
    assert exc_info.value.status_code == 401
    assert "Invalid token" in str(exc_info.value.detail)

def test_password_hashing(security_guard):
    password = "TestPassword123!"
    hashed_password = security_guard.get_password_hash(password)
    
    assert hashed_password != password
    assert security_guard.verify_password(password, hashed_password)
    assert not security_guard.verify_password("WrongPassword", hashed_password)

def test_password_strength_validation(security_guard):
    # Test minimum length
    assert not security_guard.validate_password_strength("short")
    
    # Test special characters
    if security_guard.require_special_chars:
        assert not security_guard.validate_password_strength("NoSpecialChars123")
        assert security_guard.validate_password_strength("StrongPass123!")
    
    # Test numbers
    if security_guard.require_numbers:
        assert not security_guard.validate_password_strength("NoNumbers!")
        assert security_guard.validate_password_strength("HasNumbers123!")
    
    # Test uppercase
    if security_guard.require_uppercase:
        assert not security_guard.validate_password_strength("no uppercase123!")
        assert security_guard.validate_password_strength("HasUppercase123!")

def test_failed_login_handling(security_guard, test_user):
    # Test failed login attempts
    for _ in range(security_guard.max_failed_attempts - 1):
        security_guard.handle_failed_login(test_user)
        assert not security_guard.is_account_locked(test_user)
    
    security_guard.handle_failed_login(test_user)
    assert security_guard.is_account_locked(test_user)
    assert test_user.locked_until is not None

def test_account_unlock(security_guard, test_user):
    # Lock the account
    test_user.locked_until = datetime.utcnow() + timedelta(minutes=security_guard.lockout_duration_minutes)
    assert security_guard.is_account_locked(test_user)
    
    # Reset failed attempts
    security_guard.reset_failed_attempts(test_user)
    assert not security_guard.is_account_locked(test_user)
    assert test_user.failed_attempts == 0
    assert test_user.locked_until is None

def test_secure_token_generation(security_guard):
    token1 = security_guard.generate_secure_token()
    token2 = security_guard.generate_secure_token()
    
    assert len(token1) == 32
    assert token1 != token2

def test_sensitive_data_hashing(security_guard):
    sensitive_data = "sensitive_information"
    hashed_data = security_guard.hash_sensitive_data(sensitive_data)
    
    assert hashed_data != sensitive_data
    assert security_guard.verify_sensitive_data(sensitive_data, hashed_data)
    assert not security_guard.verify_sensitive_data("wrong_data", hashed_data)

def test_refresh_token(security_guard, test_user):
    data = {"sub": test_user.username, "scopes": test_user.scopes}
    token = security_guard.create_access_token(data)
    
    # Verify refresh token
    refresh_token_data = security_guard.verify_token(token.refresh_token)
    assert refresh_token_data.username == test_user.username
    assert refresh_token_data.scopes == test_user.scopes
    
    # Verify refresh token expiration
    assert refresh_token_data.exp > datetime.utcnow() + timedelta(days=security_guard.refresh_token_expire_days - 1) 