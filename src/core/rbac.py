from typing import List, Dict, Set, Optional
from enum import Enum
from sqlalchemy import Column, String, JSON, Table, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel

from .models import Base

# Association tables for many-to-many relationships
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', String, ForeignKey('roles.id')),
    Column('permission_id', String, ForeignKey('permissions.id'))
)

user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', String, ForeignKey('users.id')),
    Column('role_id', String, ForeignKey('roles.id'))
)

class Permission(Base):
    """Permission model for RBAC."""
    __tablename__ = "permissions"

    id = Column(String, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    resource_type = Column(String, nullable=False)
    action = Column(String, nullable=False)
    conditions = Column(JSON, nullable=True)

class Role(Base):
    """Role model for RBAC."""
    __tablename__ = "roles"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    tenant_id = Column(String, nullable=False)
    is_system = Column(Boolean, default=False)
    permissions = relationship("Permission", secondary=role_permissions)
    users = relationship("User", secondary=user_roles)

class PermissionCheck(BaseModel):
    """Model for permission check results."""
    allowed: bool
    reason: Optional[str] = None
    conditions: Optional[Dict] = None

class RBACManager:
    """Manages role-based access control operations."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def create_role(
        self,
        tenant_id: str,
        name: str,
        description: Optional[str] = None,
        permissions: Optional[List[str]] = None,
        is_system: bool = False
    ) -> Role:
        """Create a new role."""
        role = Role(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name=name,
            description=description,
            is_system=is_system
        )
        
        if permissions:
            perms = await self.db.query(Permission)\
                .filter(Permission.id.in_(permissions))\
                .all()
            role.permissions.extend(perms)
        
        self.db.add(role)
        await self.db.commit()
        return role
    
    async def assign_role(
        self,
        user_id: str,
        role_id: str
    ) -> bool:
        """Assign a role to a user."""
        role = await self.db.query(Role).filter(Role.id == role_id).first()
        user = await self.db.query(User).filter(User.id == user_id).first()
        
        if not role or not user:
            return False
        
        if role not in user.roles:
            user.roles.append(role)
            await self.db.commit()
        
        return True
    
    async def remove_role(
        self,
        user_id: str,
        role_id: str
    ) -> bool:
        """Remove a role from a user."""
        role = await self.db.query(Role).filter(Role.id == role_id).first()
        user = await self.db.query(User).filter(User.id == user_id).first()
        
        if not role or not user:
            return False
        
        if role in user.roles:
            user.roles.remove(role)
            await self.db.commit()
        
        return True
    
    async def check_permission(
        self,
        user_id: str,
        resource_type: str,
        action: str,
        resource_id: Optional[str] = None,
        context: Optional[Dict] = None
    ) -> PermissionCheck:
        """Check if a user has permission to perform an action."""
        user = await self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return PermissionCheck(allowed=False, reason="User not found")
        
        # Get all permissions from user's roles
        permissions = set()
        for role in user.roles:
            for perm in role.permissions:
                if perm.resource_type == resource_type and perm.action == action:
                    permissions.add(perm)
        
        if not permissions:
            return PermissionCheck(allowed=False, reason="No matching permissions found")
        
        # Check conditions for each permission
        for perm in permissions:
            if not perm.conditions:
                return PermissionCheck(allowed=True)
            
            # Evaluate conditions
            if await self._evaluate_conditions(perm.conditions, context):
                return PermissionCheck(
                    allowed=True,
                    conditions=perm.conditions
                )
        
        return PermissionCheck(
            allowed=False,
            reason="No permissions with matching conditions found"
        )
    
    async def _evaluate_conditions(
        self,
        conditions: Dict,
        context: Optional[Dict]
    ) -> bool:
        """Evaluate permission conditions against context."""
        if not context:
            return False
        
        # Example condition evaluation
        # conditions = {
        #     "resource_owner": "user_id",
        #     "tenant_id": "equals",
        #     "time_window": {"start": "9:00", "end": "17:00"}
        # }
        
        for key, value in conditions.items():
            if key not in context:
                return False
            
            if isinstance(value, dict):
                # Handle complex conditions
                if key == "time_window":
                    current_time = datetime.now().time()
                    start_time = datetime.strptime(value["start"], "%H:%M").time()
                    end_time = datetime.strptime(value["end"], "%H:%M").time()
                    if not (start_time <= current_time <= end_time):
                        return False
            else:
                # Handle simple conditions
                if context[key] != value:
                    return False
        
        return True
    
    async def get_user_permissions(
        self,
        user_id: str
    ) -> List[Dict]:
        """Get all permissions for a user."""
        user = await self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
        
        permissions = set()
        for role in user.roles:
            for perm in role.permissions:
                permissions.add({
                    "id": perm.id,
                    "name": perm.name,
                    "resource_type": perm.resource_type,
                    "action": perm.action,
                    "conditions": perm.conditions
                })
        
        return list(permissions)

# Middleware for permission checking
class RBACMiddleware:
    """Middleware to check permissions for API requests."""
    
    def __init__(self, app, rbac_manager: RBACManager):
        self.app = app
        self.rbac_manager = rbac_manager
    
    async def __call__(self, request: Request, call_next):
        # Skip permission check for certain endpoints
        if request.url.path in ["/health", "/metrics", "/docs", "/redoc"]:
            return await call_next(request)
        
        # Get user and resource information
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            return JSONResponse(
                status_code=401,
                content={"error": "Authentication required"}
            )
        
        # Determine resource type and action from request
        resource_type = request.url.path.split("/")[1]
        action = request.method.lower()
        
        # Check permission
        check = await self.rbac_manager.check_permission(
            user_id=user_id,
            resource_type=resource_type,
            action=action,
            resource_id=request.path_params.get("id"),
            context={
                "tenant_id": getattr(request.state, "tenant_id", None),
                "user_id": user_id,
                "method": request.method,
                "path": str(request.url)
            }
        )
        
        if not check.allowed:
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Permission denied",
                    "reason": check.reason
                }
            )
        
        response = await call_next(request)
        return response 