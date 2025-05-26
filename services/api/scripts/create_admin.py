import os
import sys
import bcrypt
import secrets
import string
from datetime import datetime, timedelta
import jwt
from typing import Dict, Any

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models.user import User
from models.role import Role
from config import settings

def generate_secure_password(length: int = 16) -> str:
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()_+-=[]{}|;:,.<>?"
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        # Ensure password meets complexity requirements
        if (any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
            and any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)):
            return password

def create_admin_user(
    username: str = "admin",
    email: str = "admin@omnimind.ai",
    first_name: str = "System",
    last_name: str = "Administrator"
) -> Dict[str, Any]:
    """Create an admin user with secure credentials."""
    db = next(get_db())
    
    # Check if admin user already exists
    existing_admin = db.query(User).filter(User.username == username).first()
    if existing_admin:
        print(f"Admin user '{username}' already exists.")
        return None

    # Generate secure password
    password = generate_secure_password()
    
    # Hash password
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode(), salt)
    
    # Get admin role
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    if not admin_role:
        admin_role = Role(name="admin", description="System Administrator")
        db.add(admin_role)
        db.commit()
        db.refresh(admin_role)

    # Create admin user
    admin_user = User(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        password=hashed_password.decode(),
        is_active=True,
        is_admin=True,
        roles=[admin_role]
    )
    
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    # Generate JWT token
    token_data = {
        "sub": str(admin_user.id),
        "username": admin_user.username,
        "roles": ["admin"],
        "exp": datetime.utcnow() + timedelta(days=1)
    }
    access_token = jwt.encode(
        token_data,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    return {
        "username": username,
        "password": password,  # Only shown once
        "email": email,
        "access_token": access_token
    }

if __name__ == "__main__":
    # Create admin user
    admin_data = create_admin_user()
    
    if admin_data:
        print("\nAdmin user created successfully!")
        print("\nCredentials:")
        print(f"Username: {admin_data['username']}")
        print(f"Password: {admin_data['password']}")
        print(f"Email: {admin_data['email']}")
        print("\nIMPORTANT: Save these credentials securely. The password will not be shown again.")
        print("\nYou can now login at: http://localhost:8000/api/v1/auth/login")
        print("Use the following JSON in the request body:")
        print(f'{{"username": "{admin_data["username"]}", "password": "{admin_data["password"]}"}}') 