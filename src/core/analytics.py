from typing import Dict, List, Optional
from datetime import datetime, timedelta
from sqlalchemy import func, and_, desc
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
from prometheus_client import Counter, Histogram, Gauge

from .models import User, Task, Project, APILog, Storage


class AnalyticsManager:
    """Manages analytics and reporting operations."""
    
    def __init__(self, db_session: Session):
        self.db = db_session
        
        # Prometheus metrics
        self.active_users = Gauge(
            'active_users_total',
            'Total active users',
            ['tenant_id']
        )
        self.task_completion_rate = Gauge(
            'task_completion_rate',
            'Task completion rate',
            ['tenant_id', 'project_id']
        )
        self.api_usage = Counter(
            'api_usage_total',
            'Total API usage',
            ['tenant_id', 'endpoint']
        )
        self.storage_usage = Gauge(
            'storage_usage_bytes',
            'Storage usage in bytes',
            ['tenant_id']
        )
    
    async def get_user_analytics(
        self,
        tenant_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get user analytics."""
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Get user metrics
        total_users = await self.db.query(User).filter(
            User.tenant_id == tenant_id
        ).count()
        
        active_users = await self.db.query(User).filter(
            and_(
                User.tenant_id == tenant_id,
                User.last_login >= start_date
            )
        ).count()
        
        new_users = await self.db.query(User).filter(
            and_(
                User.tenant_id == tenant_id,
                User.created_at >= start_date
            )
        ).count()
        
        # Update Prometheus metrics
        self.active_users.labels(tenant_id=tenant_id).set(active_users)
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "new_users": new_users,
            "retention_rate": (active_users / total_users * 100) if total_users > 0 else 0
        }
    
    async def get_project_analytics(
        self,
        tenant_id: str,
        project_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get project analytics."""
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Base query
        query = self.db.query(Task).filter(
            and_(
                Task.tenant_id == tenant_id,
                Task.created_at >= start_date,
                Task.created_at <= end_date
            )
        )
        
        if project_id:
            query = query.filter(Task.project_id == project_id)
        
        # Get task metrics
        total_tasks = await query.count()
        completed_tasks = await query.filter(Task.status == "completed").count()
        overdue_tasks = await query.filter(
            and_(
                Task.due_date < datetime.utcnow(),
                Task.status != "completed"
            )
        ).count()
        
        # Calculate completion rate
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Update Prometheus metrics
        if project_id:
            self.task_completion_rate.labels(
                tenant_id=tenant_id,
                project_id=project_id
            ).set(completion_rate)
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "overdue_tasks": overdue_tasks,
            "completion_rate": completion_rate,
            "average_completion_time": await self._calculate_avg_completion_time(
                tenant_id,
                project_id,
                start_date,
                end_date
            )
        }
    
    async def get_api_analytics(
        self,
        tenant_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get API usage analytics."""
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Get API logs
        logs = await self.db.query(APILog).filter(
            and_(
                APILog.tenant_id == tenant_id,
                APILog.created_at >= start_date,
                APILog.created_at <= end_date
            )
        ).all()
        
        # Convert to DataFrame for analysis
        df = pd.DataFrame([
            {
                "endpoint": log.endpoint,
                "method": log.method,
                "status_code": log.status_code,
                "response_time": log.response_time,
                "created_at": log.created_at
            }
            for log in logs
        ])
        
        if df.empty:
            return {
                "total_requests": 0,
                "average_response_time": 0,
                "error_rate": 0,
                "endpoints": {}
            }
        
        # Calculate metrics
        total_requests = len(df)
        average_response_time = df["response_time"].mean()
        error_rate = (df["status_code"] >= 400).mean() * 100
        
        # Group by endpoint
        endpoints = df.groupby("endpoint").agg({
            "response_time": ["count", "mean"],
            "status_code": lambda x: (x >= 400).mean() * 100
        }).to_dict()
        
        # Update Prometheus metrics
        for endpoint, count in df["endpoint"].value_counts().items():
            self.api_usage.labels(
                tenant_id=tenant_id,
                endpoint=endpoint
            ).inc(count)
        
        return {
            "total_requests": total_requests,
            "average_response_time": average_response_time,
            "error_rate": error_rate,
            "endpoints": endpoints
        }
    
    async def get_storage_analytics(
        self,
        tenant_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get storage usage analytics."""
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Get storage metrics
        total_size = await self.db.query(
            func.sum(Storage.size)
        ).filter(
            Storage.tenant_id == tenant_id
        ).scalar() or 0
        
        new_files = await self.db.query(Storage).filter(
            and_(
                Storage.tenant_id == tenant_id,
                Storage.created_at >= start_date
            )
        ).count()
        
        # Group by file type
        file_types = await self.db.query(
            Storage.file_type,
            func.count(Storage.id).label("count"),
            func.sum(Storage.size).label("size")
        ).filter(
            Storage.tenant_id == tenant_id
        ).group_by(
            Storage.file_type
        ).all()
        
        # Update Prometheus metrics
        self.storage_usage.labels(tenant_id=tenant_id).set(total_size)
        
        return {
            "total_size": total_size,
            "new_files": new_files,
            "file_types": {
                ft.file_type: {
                    "count": ft.count,
                    "size": ft.size
                }
                for ft in file_types
            }
        }
    
    async def generate_report(
        self,
        tenant_id: str,
        report_type: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        format: str = "json"
    ) -> Dict:
        """Generate a comprehensive report."""
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Collect all analytics
        user_metrics = await self.get_user_analytics(
            tenant_id,
            start_date,
            end_date
        )
        project_metrics = await self.get_project_analytics(
            tenant_id,
            None,
            start_date,
            end_date
        )
        api_metrics = await self.get_api_analytics(
            tenant_id,
            start_date,
            end_date
        )
        storage_metrics = await self.get_storage_analytics(
            tenant_id,
            start_date,
            end_date
        )
        
        # Combine metrics
        report = {
            "period": {
                "start": start_date,
                "end": end_date
            },
            "users": user_metrics,
            "projects": project_metrics,
            "api": api_metrics,
            "storage": storage_metrics
        }
        
        # Add trend analysis
        report["trends"] = await self._analyze_trends(
            tenant_id,
            start_date,
            end_date
        )
        
        # Format report
        if format == "csv":
            return self._format_csv_report(report)
        elif format == "excel":
            return self._format_excel_report(report)
        
        return report
    
    async def _calculate_avg_completion_time(
        self,
        tenant_id: str,
        project_id: Optional[str],
        start_date: datetime,
        end_date: datetime
    ) -> float:
        """Calculate average task completion time."""
        query = self.db.query(Task).filter(
            and_(
                Task.tenant_id == tenant_id,
                Task.status == "completed",
                Task.completed_at >= start_date,
                Task.completed_at <= end_date
            )
        )
        
        if project_id:
            query = query.filter(Task.project_id == project_id)
        
        tasks = await query.all()
        
        if not tasks:
            return 0.0
        
        completion_times = [
            (task.completed_at - task.created_at).total_seconds()
            for task in tasks
        ]
        
        return np.mean(completion_times)
    
    async def _analyze_trends(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """Analyze trends in metrics."""
        # Get daily metrics
        days = (end_date - start_date).days
        daily_metrics = []
        
        for i in range(days):
            date = start_date + timedelta(days=i)
            metrics = {
                "date": date,
                "users": await self.get_user_analytics(
                    tenant_id,
                    date,
                    date + timedelta(days=1)
                ),
                "projects": await self.get_project_analytics(
                    tenant_id,
                    None,
                    date,
                    date + timedelta(days=1)
                ),
                "api": await self.get_api_analytics(
                    tenant_id,
                    date,
                    date + timedelta(days=1)
                )
            }
            daily_metrics.append(metrics)
        
        # Calculate trends
        df = pd.DataFrame(daily_metrics)
        
        return {
            "user_growth": self._calculate_growth_rate(
                df["users"].apply(lambda x: x["active_users"])
            ),
            "task_completion_growth": self._calculate_growth_rate(
                df["projects"].apply(lambda x: x["completion_rate"])
            ),
            "api_usage_growth": self._calculate_growth_rate(
                df["api"].apply(lambda x: x["total_requests"])
            )
        }
    
    def _calculate_growth_rate(self, series: pd.Series) -> float:
        """Calculate growth rate from a time series."""
        if len(series) < 2:
            return 0.0
        
        first_value = series.iloc[0]
        last_value = series.iloc[-1]
        
        if first_value == 0:
            return 0.0
        
        return ((last_value - first_value) / first_value) * 100
    
    def _format_csv_report(self, report: Dict) -> str:
        """Format report as CSV."""
        # Implementation for CSV formatting
        pass
    
    def _format_excel_report(self, report: Dict) -> bytes:
        """Format report as Excel."""
        # Implementation for Excel formatting
        pass 