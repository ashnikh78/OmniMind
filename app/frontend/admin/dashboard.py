from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
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

class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=1, le=100, description="Items per page")
    role_filter: Optional[str] = Field(None, description="Filter for roles")
    permission_filter: Optional[str] = Field(None, description="Filter for permissions")
    log_type: Optional[str] = Field(None, description="Filter for log type")

@router.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
) -> HTMLResponse:
    """Render the admin dashboard main page."""
    return templates.TemplateResponse(
        "admin/dashboard.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Admin Dashboard"
        }
    )

@router.get("/monitoring", response_class=HTMLResponse)
async def monitoring_panel(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
) -> HTMLResponse:
    """Render the system monitoring panel with performance metrics."""
    try:
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
    except Exception as e:
        logger.error(f"Error in monitoring panel: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load monitoring data")

@router.get("/moderation", response_class=HTMLResponse)
async def moderation_panel(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
) -> HTMLResponse:
    """Render the content moderation panel with flagged content and stats."""
    try:
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
    except Exception as e:
        logger.error(f"Error in moderation panel: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load moderation data")

@router.get("/audit", response_class=HTMLResponse)
async def audit_panel(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
) -> HTMLResponse:
    """Render the audit logs panel with error and compliance logs."""
    try:
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
    except Exception as e:
        logger.error(f"Error in audit panel: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load audit data")

@router.get("/users", response_class=HTMLResponse)
async def user_management(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
) -> HTMLResponse:
    """Render the user management panel with user data and activities."""
    try:
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
    except Exception as e:
        logger.error(f"Error in user management panel: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load user data")

@router.get("/access", response_class=HTMLResponse)
async def access_management(
    request: Request,
    params: PaginationParams = Depends(),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _: None = Depends(require_scope("admin"))
) -> HTMLResponse:
    """Render the access control management panel with roles and permissions."""
    try:
        access_data = {
            "roles": await get_roles(params.page, params.per_page, params.role_filter),
            "permissions": await get_permissions(params.page, params.per_page, params.permission_filter),
            "access_logs": await get_access_logs(params.page, params.per_page, params.log_type),
            "access_stats": await get_access_stats(),
            "all_permissions": await get_all_permissions(),
            "pagination": {
                "current_page": params.page,
                "per_page": params.per_page,
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
                    "role": params.role_filter,
                    "permission": params.permission_filter,
                    "log_type": params.log_type
                }
            }
        )
    except Exception as e:
        logger.error(f"Error in access management panel: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Helper functions
async def get_active_users() -> List[Dict[str, Any]]:
    """Retrieve a list of active users from the database."""
    try:
        users = await db.users.find_many(
            where={"is_active": True},
            include={"profile": True}
        )
        return [
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "created_at": user.created_at,
                "last_active": user.last_active
            } for user in users
        ]
    except Exception as e:
        logger.error(f"Error fetching active users: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching active users")

async def get_user_stats() -> Dict[str, Any]:
    """Retrieve user statistics such as total users and activity metrics."""
    try:
        total_users = await db.users.count()
        active_users = await db.users.count(where={"is_active": True})
        return {
            "total_users": total_users,
            "active_users": active_users,
            "signup_rate": await db.users.count(where={"created_at": {"gte": datetime.utcnow() - timedelta(days=30)}})
        }
    except Exception as e:
        logger.error(f"Error fetching user stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching user stats")

async def get_recent_user_activities() -> List[Dict[str, Any]]:
    """Retrieve recent user activities from the database."""
    try:
        activities = await db.user_activities.find_many(
            take=50,
            order_by={"timestamp": "desc"},
            include={"user": {"select": {"id": True, "name": True}}}
        )
        return [
            {
                "id": activity.id,
                "user_id": activity.user_id,
                "user_name": activity.user.name,
                "action": activity.action,
                "timestamp": activity.timestamp
            } for activity in activities
        ]
    except Exception as e:
        logger.error(f"Error fetching user activities: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching user activities")

async def get_roles(page: int = 1, per_page: int = 20, filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve available roles with pagination and optional filtering."""
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
                "name": role