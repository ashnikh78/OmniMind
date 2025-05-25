from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel
import json

from .models import Base

class AuditLog(Base):
    """Audit log model for tracking system events."""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    user_id = Column(String, nullable=True)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLogEntry(BaseModel):
    """Pydantic model for audit log entries."""
    id: str
    tenant_id: str
    user_id: Optional[str]
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

class AuditLogger:
    """Manages audit logging operations."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def log(
        self,
        tenant_id: str,
        action: str,
        resource_type: str,
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> AuditLogEntry:
        """Create a new audit log entry."""
        log = AuditLog(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        self.db.add(log)
        await self.db.commit()
        
        return AuditLogEntry.from_orm(log)
    
    async def get_logs(
        self,
        tenant_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        page: int = 1,
        per_page: int = 50
    ) -> Dict[str, Any]:
        """Retrieve audit logs with filtering and pagination."""
        query = self.db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
        
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if resource_id:
            query = query.filter(AuditLog.resource_id == resource_id)
        
        total = await query.count()
        logs = await query.order_by(AuditLog.created_at.desc())\
            .offset((page - 1) * per_page)\
            .limit(per_page)\
            .all()
        
        return {
            "data": [AuditLogEntry.from_orm(log) for log in logs],
            "meta": {
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": (total + per_page - 1) // per_page
            }
        }
    
    async def export_logs(
        self,
        tenant_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        format: str = "json"
    ) -> bytes:
        """Export audit logs in specified format."""
        query = self.db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
        
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        
        logs = await query.order_by(AuditLog.created_at.desc()).all()
        
        if format == "json":
            return json.dumps([
                AuditLogEntry.from_orm(log).dict()
                for log in logs
            ]).encode()
        elif format == "csv":
            # Implement CSV export
            pass
        elif format == "excel":
            # Implement Excel export
            pass
        
        raise ValueError(f"Unsupported export format: {format}")

# Middleware for automatic audit logging
class AuditLogMiddleware:
    """Middleware to automatically log API requests."""
    
    def __init__(self, app, audit_logger: AuditLogger):
        self.app = app
        self.audit_logger = audit_logger
    
    async def __call__(self, request: Request, call_next):
        # Skip logging for certain endpoints
        if request.url.path in ["/health", "/metrics"]:
            return await call_next(request)
        
        # Get request details
        tenant_id = getattr(request.state, "tenant_id", None)
        user_id = getattr(request.state, "user_id", None)
        
        # Log the request
        await self.audit_logger.log(
            tenant_id=tenant_id,
            user_id=user_id,
            action=f"{request.method}_{request.url.path}",
            resource_type="api_request",
            details={
                "method": request.method,
                "path": str(request.url),
                "query_params": dict(request.query_params),
                "headers": dict(request.headers)
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        response = await call_next(request)
        return response 