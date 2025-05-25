from typing import Dict, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
import jwt
import bcrypt

from .models import Base
from .config import settings

class EncryptionKey(Base):
    """Encryption key model."""
    __tablename__ = "encryption_keys"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    key_type = Column(String, nullable=False)  # data, backup, archive
    key_data = Column(String, nullable=False)  # encrypted key
    version = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    metadata = Column(JSON, nullable=True)

class SecurityManager:
    """Manages security and encryption operations."""
    
    def __init__(self, db_session, audit_logger):
        self.db = db_session
        self.audit_logger = audit_logger
        self._initialize_encryption()
    
    def _initialize_encryption(self):
        """Initialize encryption components."""
        # Generate or load master key
        self.master_key = self._get_or_create_master_key()
        
        # Initialize Fernet cipher
        self.cipher = Fernet(self.master_key)
    
    def _get_or_create_master_key(self) -> bytes:
        """Get or create master encryption key."""
        # In production, this should be stored in a secure key management system
        # like AWS KMS, HashiCorp Vault, or Azure Key Vault
        key_file = "master.key"
        
        if os.path.exists(key_file):
            with open(key_file, "rb") as f:
                return f.read()
        
        key = Fernet.generate_key()
        with open(key_file, "wb") as f:
            f.write(key)
        return key
    
    async def create_encryption_key(
        self,
        tenant_id: str,
        key_type: str,
        version: int = 1,
        expires_at: Optional[datetime] = None,
        metadata: Optional[Dict] = None
    ) -> EncryptionKey:
        """Create a new encryption key."""
        # Generate new key
        key = Fernet.generate_key()
        
        # Encrypt key with master key
        encrypted_key = self.cipher.encrypt(key)
        
        # Store key
        db_key = EncryptionKey(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            key_type=key_type,
            key_data=base64.b64encode(encrypted_key).decode(),
            version=version,
            expires_at=expires_at,
            metadata=metadata
        )
        
        self.db.add(db_key)
        await self.db.commit()
        
        # Log key creation
        await self.audit_logger.log(
            tenant_id=tenant_id,
            action="create_encryption_key",
            resource_type="key",
            resource_id=db_key.id,
            details={
                "key_type": key_type,
                "version": version,
                "expires_at": expires_at.isoformat() if expires_at else None
            }
        )
        
        return db_key
    
    async def get_active_key(
        self,
        tenant_id: str,
        key_type: str
    ) -> Optional[EncryptionKey]:
        """Get active encryption key for tenant."""
        return await self.db.query(EncryptionKey).filter(
            EncryptionKey.tenant_id == tenant_id,
            EncryptionKey.key_type == key_type,
            EncryptionKey.is_active == True,
            or_(
                EncryptionKey.expires_at == None,
                EncryptionKey.expires_at > datetime.utcnow()
            )
        ).first()
    
    def encrypt_data(
        self,
        data: bytes,
        key: EncryptionKey
    ) -> bytes:
        """Encrypt data using specified key."""
        # Decrypt key
        encrypted_key = base64.b64decode(key.key_data)
        decrypted_key = self.cipher.decrypt(encrypted_key)
        
        # Create cipher with decrypted key
        cipher = Fernet(decrypted_key)
        
        # Encrypt data
        return cipher.encrypt(data)
    
    def decrypt_data(
        self,
        encrypted_data: bytes,
        key: EncryptionKey
    ) -> bytes:
        """Decrypt data using specified key."""
        # Decrypt key
        encrypted_key = base64.b64decode(key.key_data)
        decrypted_key = self.cipher.decrypt(encrypted_key)
        
        # Create cipher with decrypted key
        cipher = Fernet(decrypted_key)
        
        # Decrypt data
        return cipher.decrypt(encrypted_data)
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt."""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode(), salt).decode()
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash."""
        return bcrypt.checkpw(password.encode(), hashed.encode())
    
    def generate_jwt(
        self,
        user_id: str,
        tenant_id: str,
        roles: List[str],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Generate JWT token."""
        if not expires_delta:
            expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        expire = datetime.utcnow() + expires_delta
        
        to_encode = {
            "sub": user_id,
            "tenant_id": tenant_id,
            "roles": roles,
            "exp": expire
        }
        
        return jwt.encode(
            to_encode,
            settings.SECRET_KEY.get_secret_value(),
            algorithm=settings.JWT_ALGORITHM
        )
    
    def verify_jwt(self, token: str) -> Dict:
        """Verify JWT token."""
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY.get_secret_value(),
                algorithms=[settings.JWT_ALGORITHM]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.JWTError:
            raise ValueError("Invalid token")
    
    async def rotate_encryption_key(
        self,
        tenant_id: str,
        key_type: str
    ) -> EncryptionKey:
        """Rotate encryption key."""
        # Get current active key
        current_key = await self.get_active_key(tenant_id, key_type)
        if not current_key:
            raise ValueError(f"No active key found for type: {key_type}")
        
        # Create new key
        new_key = await self.create_encryption_key(
            tenant_id=tenant_id,
            key_type=key_type,
            version=current_key.version + 1
        )
        
        # Mark old key as inactive
        current_key.is_active = False
        await self.db.commit()
        
        # Log key rotation
        await self.audit_logger.log(
            tenant_id=tenant_id,
            action="rotate_encryption_key",
            resource_type="key",
            resource_id=new_key.id,
            details={
                "key_type": key_type,
                "old_version": current_key.version,
                "new_version": new_key.version
            }
        )
        
        return new_key
    
    async def schedule_key_rotation(
        self,
        tenant_id: str,
        key_type: str,
        rotation_period_days: int
    ):
        """Schedule automatic key rotation."""
        # Implement key rotation scheduling
        # This could use a task queue like Celery
        pass
    
    async def get_key_rotation_status(
        self,
        tenant_id: str,
        key_type: str
    ) -> Dict[str, Any]:
        """Get key rotation status."""
        keys = await self.db.query(EncryptionKey).filter(
            EncryptionKey.tenant_id == tenant_id,
            EncryptionKey.key_type == key_type
        ).order_by(EncryptionKey.version.desc()).all()
        
        return {
            "current_version": keys[0].version if keys else None,
            "last_rotation": keys[0].created_at if keys else None,
            "next_rotation": keys[0].expires_at if keys and keys[0].expires_at else None,
            "key_history": [
                {
                    "version": key.version,
                    "created_at": key.created_at,
                    "expires_at": key.expires_at,
                    "is_active": key.is_active
                }
                for key in keys
            ]
        }
    
    async def revoke_key(
        self,
        key_id: str,
        tenant_id: str
    ) -> bool:
        """Revoke encryption key."""
        key = await self.db.query(EncryptionKey).filter(
            EncryptionKey.id == key_id,
            EncryptionKey.tenant_id == tenant_id
        ).first()
        
        if not key:
            return False
        
        key.is_active = False
        await self.db.commit()
        
        # Log key revocation
        await self.audit_logger.log(
            tenant_id=tenant_id,
            action="revoke_encryption_key",
            resource_type="key",
            resource_id=key_id,
            details={
                "key_type": key.key_type,
                "version": key.version
            }
        )
        
        return True 