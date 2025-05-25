from typing import Optional, Dict, List
from datetime import datetime
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Tenant(Base):
    """Tenant model for multi-tenancy support."""
    __tablename__ = "tenants"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    domain = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, default={})
    subscription_tier = Column(String, default="basic")
    subscription_status = Column(String, default="active")
    max_users = Column(Integer, default=10)
    max_storage = Column(Integer, default=1073741824)  # 1GB in bytes
    max_api_calls = Column(Integer, default=10000)
    custom_domain = Column(String, nullable=True)
    ssl_certificate = Column(JSON, nullable=True)


class TenantSettings(BaseModel):
    """Tenant-specific settings."""
    theme: Dict[str, str] = Field(default_factory=dict)
    features: List[str] = Field(default_factory=list)
    integrations: Dict[str, Dict] = Field(default_factory=dict)
    security: Dict[str, bool] = Field(default_factory=dict)
    notifications: Dict[str, bool] = Field(default_factory=dict)
    branding: Dict[str, str] = Field(default_factory=dict)


class TenantManager:
    """Manages tenant operations and settings."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def create_tenant(
        self,
        name: str,
        domain: str,
        subscription_tier: str = "basic",
        settings: Optional[Dict] = None
    ) -> Tenant:
        """Create a new tenant."""
        tenant = Tenant(
            id=str(uuid.uuid4()),
            name=name,
            domain=domain,
            subscription_tier=subscription_tier,
            settings=settings or {}
        )
        self.db.add(tenant)
        await self.db.commit()
        return tenant
    
    async def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        """Get tenant by ID."""
        return await self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    async def get_tenant_by_domain(self, domain: str) -> Optional[Tenant]:
        """Get tenant by domain."""
        return await self.db.query(Tenant).filter(Tenant.domain == domain).first()
    
    async def update_tenant_settings(
        self,
        tenant_id: str,
        settings: Dict
    ) -> Optional[Tenant]:
        """Update tenant settings."""
        tenant = await self.get_tenant(tenant_id)
        if tenant:
            tenant.settings.update(settings)
            tenant.updated_at = datetime.utcnow()
            await self.db.commit()
        return tenant
    
    async def deactivate_tenant(self, tenant_id: str) -> bool:
        """Deactivate a tenant."""
        tenant = await self.get_tenant(tenant_id)
        if tenant:
            tenant.is_active = False
            tenant.updated_at = datetime.utcnow()
            await self.db.commit()
            return True
        return False
    
    async def get_tenant_usage(self, tenant_id: str) -> Dict:
        """Get tenant resource usage."""
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return {}
        
        # Calculate usage metrics
        user_count = await self.db.query(User).filter(
            User.tenant_id == tenant_id
        ).count()
        
        storage_used = await self.db.query(Storage).filter(
            Storage.tenant_id == tenant_id
        ).with_entities(
            func.sum(Storage.size)
        ).scalar() or 0
        
        api_calls = await self.db.query(APILog).filter(
            APILog.tenant_id == tenant_id,
            APILog.created_at >= datetime.utcnow() - timedelta(days=30)
        ).count()
        
        return {
            "users": {
                "used": user_count,
                "limit": tenant.max_users,
                "percentage": (user_count / tenant.max_users) * 100
            },
            "storage": {
                "used": storage_used,
                "limit": tenant.max_storage,
                "percentage": (storage_used / tenant.max_storage) * 100
            },
            "api_calls": {
                "used": api_calls,
                "limit": tenant.max_api_calls,
                "percentage": (api_calls / tenant.max_api_calls) * 100
            }
        }


# Middleware for tenant context
class TenantMiddleware:
    """Middleware to handle tenant context in requests."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, request: Request, call_next):
        # Extract tenant from request
        tenant_id = request.headers.get("X-Tenant-ID")
        domain = request.headers.get("Host")
        
        if not tenant_id and domain:
            # Try to get tenant from domain
            tenant = await tenant_manager.get_tenant_by_domain(domain)
            if tenant:
                tenant_id = tenant.id
        
        if tenant_id:
            # Set tenant context
            request.state.tenant_id = tenant_id
            request.state.tenant = await tenant_manager.get_tenant(tenant_id)
        
        response = await call_next(request)
        return response 