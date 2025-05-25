from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.core.security import get_current_user, require_scope
from app.core.monitoring import performance_monitor, health_check, alert_manager
from app.core.error_reporting import error_reporter
from app.core.compliance import compliance_guard
from app.core.database import db
from app.core.logger import logger

router = APIRouter(prefix="/admin")
templates = Jinja2Templates(directory="app/frontend/templates")

# Mount static files
router.mount("/static", StaticFiles(directory="app/frontend/static"), name="static")

@router.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
):
    """Admin dashboard main page"""
    return templates.TemplateResponse(
        "admin/dashboard.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Admin Dashboard"
        }
    )

@router.get("/monitoring")
async def monitoring_panel(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
):
    """System monitoring panel"""
    # Get system metrics
    metrics = {
        "performance": performance_monitor.get_model_performance_stats("all"),
        "health": await health_check.check_health(),
        "alerts": alert_manager.alert_history,
        "resource_usage": {
            "memory": performance_monitor.performance_history["memory_usage"][-1] if performance_monitor.performance_history["memory_usage"] else 0,
            "cpu": performance_monitor.performance_history["cpu_usage"][-1] if performance_monitor.performance_history["cpu_usage"] else 0
        }
    }
    
    return templates.TemplateResponse(
        "admin/monitoring.html",
        {
            "request": request,
            "user": current_user,
            "metrics": metrics,
            "page_title": "System Monitoring"
        }
    )

@router.get("/moderation")
async def moderation_panel(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
):
    """Content moderation panel"""
    # Get moderation data
    moderation_data = {
        "flagged_content": await compliance_guard.get_flagged_content(),
        "moderation_stats": await compliance_guard.get_moderation_stats(),
        "recent_decisions": await compliance_guard.get_recent_decisions()
    }
    
    return templates.TemplateResponse(
        "admin/moderation.html",
        {
            "request": request,
            "user": current_user,
            "moderation_data": moderation_data,
            "page_title": "Content Moderation"
        }
    )

@router.get("/audit")
async def audit_panel(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
):
    """Audit logs panel"""
    # Get audit data
    audit_data = {
        "error_logs": await error_reporter.get_error_stats(),
        "access_logs": await compliance_guard.get_access_logs(),
        "compliance_logs": await compliance_guard.get_compliance_logs()
    }
    
    return templates.TemplateResponse(
        "admin/audit.html",
        {
            "request": request,
            "user": current_user,
            "audit_data": audit_data,
            "page_title": "Audit Logs"
        }
    )

@router.get("/users")
async def user_management(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
):
    """User management panel"""
    # Get user data
    user_data = {
        "active_users": await get_active_users(),
        "user_stats": await get_user_stats(),
        "recent_activities": await get_recent_user_activities()
    }
    
    return templates.TemplateResponse(
        "admin/users.html",
        {
            "request": request,
            "user": current_user,
            "user_data": user_data,
            "page_title": "User Management"
        }
    )

@router.get("/access")
async def access_management(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin")),
    page: int = 1,
    per_page: int = 20,
    role_filter: str = None,
    permission_filter: str = None,
    log_type: str = None
):
    """Access control management panel"""
    try:
        # Get access control data with pagination
        access_data = {
            "roles": await get_roles(page=page, per_page=per_page, filter=role_filter),
            "permissions": await get_permissions(page=page, per_page=per_page, filter=permission_filter),
            "access_logs": await get_access_logs(page=page, per_page=per_page, log_type=log_type),
            "access_stats": await get_access_stats(),
            "all_permissions": await get_all_permissions(),  # For role creation modal
            "pagination": {
                "current_page": page,
                "per_page": per_page,
                "total_roles": await count_roles(),
                "total_permissions": await count_permissions(),
                "total_logs": await count_access_logs()
            }
        }
        
        return templates.TemplateResponse(
            "admin/access.html",
            {
                "request": request,
                "user": current_user,
                "access_data": access_data,
                "page_title": "Access Control",
                "filters": {
                    "role": role_filter,
                    "permission": permission_filter,
                    "log_type": log_type
                }
            }
        )
    except Exception as e:
        logger.error(f"Error in access management panel: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Helper functions
async def get_active_users() -> List[Dict[str, Any]]:
    """Get list of active users"""
    # Implement user retrieval logic
    pass

async def get_user_stats() -> Dict[str, Any]:
    """Get user statistics"""
    # Implement user stats logic
    pass

async def get_recent_user_activities() -> List[Dict[str, Any]]:
    """Get recent user activities"""
    # Implement activity retrieval logic
    pass

async def get_roles(page: int = 1, per_page: int = 20, filter: str = None) -> List[Dict[str, Any]]:
    """Get available roles with pagination and filtering"""
    try:
        roles = await db.roles.find_many(
            skip=(page - 1) * per_page,
            take=per_page,
            where={"name": {"contains": filter}} if filter else None,
            include={
                "permissions": True,
                "users": {
                    "select": {
                        "id": True,
                        "name": True,
                        "email": True
                    }
                }
            }
        )
        return [
            {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "permissions": [p.name for p in role.permissions],
                "user_count": len(role.users),
                "created_at": role.created_at,
                "updated_at": role.updated_at
            }
            for role in roles
        ]
    except Exception as e:
        logger.error(f"Error fetching roles: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching roles")

async def get_permissions(page: int = 1, per_page: int = 20, filter: str = None) -> List[Dict[str, Any]]:
    """Get available permissions with pagination and filtering"""
    try:
        permissions = await db.permissions.find_many(
            skip=(page - 1) * per_page,
            take=per_page,
            where={"name": {"contains": filter}} if filter else None,
            include={
                "roles": {
                    "select": {
                        "id": True,
                        "name": True
                    }
                }
            }
        )
        return [
            {
                "id": perm.id,
                "name": perm.name,
                "category": perm.category,
                "description": perm.description,
                "roles": [r.name for r in perm.roles],
                "created_at": perm.created_at,
                "updated_at": perm.updated_at
            }
            for perm in permissions
        ]
    except Exception as e:
        logger.error(f"Error fetching permissions: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching permissions")

async def get_access_logs(page: int = 1, per_page: int = 20, log_type: str = None) -> List[Dict[str, Any]]:
    """Get access control logs with pagination and filtering"""
    try:
        logs = await db.access_logs.find_many(
            skip=(page - 1) * per_page,
            take=per_page,
            where={"type": log_type} if log_type else None,
            include={
                "user": {
                    "select": {
                        "id": True,
                        "name": True,
                        "email": True,
                        "avatar": True
                    }
                }
            },
            order_by={"timestamp": "desc"}
        )
        return [
            {
                "id": log.id,
                "timestamp": log.timestamp,
                "type": log.type,
                "resource": log.resource,
                "status": log.status,
                "user": log.user,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent
            }
            for log in logs
        ]
    except Exception as e:
        logger.error(f"Error fetching access logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching access logs")

async def get_access_stats() -> Dict[str, Any]:
    """Get access control statistics"""
    try:
        return {
            "total_roles": await count_roles(),
            "total_permissions": await count_permissions(),
            "access_violations": await count_access_violations(),
            "active_sessions": await count_active_sessions()
        }
    except Exception as e:
        logger.error(f"Error fetching access stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching access stats")

async def get_all_permissions() -> List[Dict[str, Any]]:
    """Get all permissions for role creation modal"""
    try:
        permissions = await db.permissions.find_many(
            order_by={"category": "asc", "name": "asc"}
        )
        return [
            {
                "id": perm.id,
                "name": perm.name,
                "category": perm.category,
                "description": perm.description
            }
            for perm in permissions
        ]
    except Exception as e:
        logger.error(f"Error fetching all permissions: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching permissions")

# Count functions
async def count_roles() -> int:
    """Count total number of roles"""
    return await db.roles.count()

async def count_permissions() -> int:
    """Count total number of permissions"""
    return await db.permissions.count()

async def count_access_logs() -> int:
    """Count total number of access logs"""
    return await db.access_logs.count()

async def count_access_violations() -> int:
    """Count total number of access violations"""
    return await db.access_logs.count(
        where={"status": "failed"}
    )

async def count_active_sessions() -> int:
    """Count number of active sessions"""
    return await db.sessions.count(
        where={
            "expires_at": {"gt": datetime.utcnow()}
        }
    ) 