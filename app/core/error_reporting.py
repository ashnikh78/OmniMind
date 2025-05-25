from typing import Dict, Any, Optional, List
import logging
import json
import traceback
from datetime import datetime, timedelta
import asyncio
import aiofiles
import os
from dataclasses import dataclass
from enum import Enum
import hashlib
from app.core.config import settings
from app.core.monitoring import logger, performance_monitor
from app.core.siem_integration import siem_integration, SIEMEvent

class ErrorSeverity(Enum):
    CRITICAL = "critical"  # System-wide impact, immediate attention required
    HIGH = "high"         # Significant impact, urgent attention needed
    MEDIUM = "medium"     # Moderate impact, attention needed soon
    LOW = "low"          # Minor impact, routine attention
    INFO = "info"        # Informational, no immediate action needed
    DEBUG = "debug"      # Debug information, development use only

class ErrorCategory(Enum):
    # System Errors
    SYSTEM = "system"           # Core system failures
    PERFORMANCE = "performance" # Performance degradation
    RESOURCE = "resource"      # Resource exhaustion
    CONFIGURATION = "config"   # Configuration issues
    
    # Security Errors
    SECURITY = "security"      # Security violations
    AUTHENTICATION = "auth"    # Authentication failures
    AUTHORIZATION = "authz"    # Authorization failures
    COMPLIANCE = "compliance"  # Compliance violations
    
    # Data Errors
    DATA = "data"             # Data integrity issues
    DATABASE = "database"     # Database errors
    CACHE = "cache"          # Cache errors
    STORAGE = "storage"      # Storage errors
    
    # Network Errors
    NETWORK = "network"       # Network connectivity issues
    API = "api"              # API errors
    SERVICE = "service"      # Service communication errors
    LOAD_BALANCER = "lb"     # Load balancer issues
    
    # Application Errors
    VALIDATION = "validation" # Input validation errors
    BUSINESS = "business"    # Business logic errors
    INTEGRATION = "integration" # Third-party integration errors
    WORKFLOW = "workflow"    # Workflow/process errors
    
    # User Errors
    USER = "user"            # User-related errors
    SESSION = "session"      # Session management errors
    PERMISSION = "permission" # Permission-related errors
    
    # Monitoring Errors
    MONITORING = "monitoring" # Monitoring system errors
    ALERTING = "alerting"    # Alert system errors
    METRICS = "metrics"      # Metrics collection errors
    
    # Infrastructure Errors
    INFRASTRUCTURE = "infra" # Infrastructure issues
    DEPLOYMENT = "deploy"    # Deployment errors
    SCALING = "scaling"      # Scaling issues
    
    # Compliance and Audit
    AUDIT = "audit"         # Audit logging errors
    RETENTION = "retention" # Data retention errors
    BACKUP = "backup"      # Backup/restore errors

@dataclass
class ErrorContext:
    timestamp: datetime
    severity: ErrorSeverity
    category: ErrorCategory
    source: str
    trace_id: str
    user_id: Optional[str]
    session_id: Optional[str]
    request_id: Optional[str]
    environment: str
    component: str
    stack_trace: str
    error_message: str
    additional_data: Dict[str, Any]
    impact_level: str  # System, Service, User
    affected_components: List[str]
    business_impact: str
    resolution_time: Optional[int]  # Estimated resolution time in minutes
    requires_immediate_action: bool
    notification_channels: List[str]
    escalation_path: List[str]
    related_incidents: List[str]
    tags: List[str]

class ErrorReporter:
    def __init__(self):
        self.log_path = "logs/errors"
        self.siem_path = "logs/siem"
        self.incident_path = "logs/incidents"
        self.error_cache = {}
        self.incident_cache = {}
        self.error_thresholds = {
            ErrorSeverity.CRITICAL: 1,    # per hour
            ErrorSeverity.HIGH: 5,        # per hour
            ErrorSeverity.MEDIUM: 20,     # per hour
            ErrorSeverity.LOW: 50,        # per hour
            ErrorSeverity.INFO: 100,      # per hour
            ErrorSeverity.DEBUG: 200      # per hour
        }
        
        # Impact-based thresholds
        self.impact_thresholds = {
            "System": {
                ErrorSeverity.CRITICAL: 1,
                ErrorSeverity.HIGH: 3,
                ErrorSeverity.MEDIUM: 10
            },
            "Service": {
                ErrorSeverity.CRITICAL: 2,
                ErrorSeverity.HIGH: 5,
                ErrorSeverity.MEDIUM: 15
            },
            "User": {
                ErrorSeverity.CRITICAL: 3,
                ErrorSeverity.HIGH: 8,
                ErrorSeverity.MEDIUM: 20
            }
        }
        
        # Ensure log directories exist with proper permissions
        for path in [self.log_path, self.siem_path, self.incident_path]:
            os.makedirs(path, mode=0o700, exist_ok=True)
        
        # Register metrics
        performance_monitor.register_metric("error_reports", "counter")
        performance_monitor.register_metric("error_incidents", "counter")
        performance_monitor.register_metric("error_alerts", "counter")
        performance_monitor.register_metric("error_resolution_time", "histogram")
        performance_monitor.register_metric("error_impact_score", "gauge")
        performance_monitor.register_metric("error_frequency", "counter")
        performance_monitor.register_metric("error_pattern_matches", "counter")
    
    async def report_error(
        self,
        error: Exception,
        severity: ErrorSeverity,
        category: ErrorCategory,
        context: Dict[str, Any]
    ) -> str:
        error_id = self._generate_error_id(error, context)
        timestamp = datetime.utcnow()
        
        # Calculate impact score
        impact_score = self._calculate_impact_score(severity, context)
        
        # Create error context
        error_context = ErrorContext(
            timestamp=timestamp,
            severity=severity,
            category=category,
            source=context.get("source", "unknown"),
            trace_id=context.get("trace_id", ""),
            user_id=context.get("user_id"),
            session_id=context.get("session_id"),
            request_id=context.get("request_id"),
            environment=settings.ENVIRONMENT,
            component=context.get("component", "unknown"),
            stack_trace=traceback.format_exc(),
            error_message=str(error),
            additional_data=context.get("additional_data", {}),
            impact_level=context.get("impact_level", "Service"),
            affected_components=context.get("affected_components", []),
            business_impact=context.get("business_impact", "Unknown"),
            resolution_time=context.get("resolution_time"),
            requires_immediate_action=context.get("requires_immediate_action", False),
            notification_channels=context.get("notification_channels", []),
            escalation_path=context.get("escalation_path", []),
            related_incidents=context.get("related_incidents", []),
            tags=context.get("tags", [])
        )
        
        # Update error cache
        self._update_error_cache(error_id, error_context)
        
        # Write to error log
        await self._write_error_log(error_id, error_context)
        
        # Send to SIEM
        await self._send_to_siem(error_id, error_context)
        
        # Check for incident creation
        if self._should_create_incident(error_context):
            await self._create_incident(error_id, error_context)
        
        # Record metrics
        performance_monitor.increment_counter(
            "error_reports",
            {
                "severity": severity.value,
                "category": category.value,
                "component": error_context.component,
                "impact_level": error_context.impact_level
            }
        )
        
        performance_monitor.set_gauge(
            "error_impact_score",
            impact_score,
            {
                "severity": severity.value,
                "category": category.value,
                "component": error_context.component
            }
        )
        
        return error_id
    
    def _generate_error_id(self, error: Exception, context: Dict[str, Any]) -> str:
        error_data = f"{str(error)}{context.get('source', '')}{context.get('trace_id', '')}"
        return hashlib.sha256(error_data.encode()).hexdigest()[:16]
    
    def _update_error_cache(self, error_id: str, error_context: ErrorContext):
        if error_id not in self.error_cache:
            self.error_cache[error_id] = []
        
        self.error_cache[error_id].append(error_context)
        
        # Clean up old entries
        cutoff_time = datetime.utcnow() - timedelta(hours=1)
        self.error_cache[error_id] = [
            entry for entry in self.error_cache[error_id]
            if entry.timestamp > cutoff_time
        ]
    
    async def _write_error_log(self, error_id: str, error_context: ErrorContext):
        log_entry = {
            "error_id": error_id,
            "timestamp": error_context.timestamp.isoformat(),
            "severity": error_context.severity.value,
            "category": error_context.category.value,
            "source": error_context.source,
            "trace_id": error_context.trace_id,
            "user_id": error_context.user_id,
            "session_id": error_context.session_id,
            "request_id": error_context.request_id,
            "environment": error_context.environment,
            "component": error_context.component,
            "error_message": error_context.error_message,
            "stack_trace": error_context.stack_trace,
            "additional_data": error_context.additional_data
        }
        
        log_file = f"{self.log_path}/errors_{datetime.utcnow().date()}.log"
        async with aiofiles.open(log_file, mode="a") as f:
            await f.write(json.dumps(log_entry) + "\n")
    
    async def _send_to_siem(self, error_id: str, error_context: ErrorContext):
        # Send to SIEM integration
        await siem_integration.send_event(
            event_type="error",
            severity=error_context.severity.value,
            source=error_context.source,
            category=error_context.category.value,
            details={
                "error_id": error_id,
                "error_message": error_context.error_message,
                "stack_trace": error_context.stack_trace,
                "component": error_context.component,
                "environment": error_context.environment,
                "additional_data": error_context.additional_data
            },
            user_id=error_context.user_id,
            session_id=error_context.session_id,
            trace_id=error_context.trace_id
        )
    
    def _calculate_impact_score(self, severity: ErrorSeverity, context: Dict[str, Any]) -> float:
        """Calculate impact score based on severity and context"""
        base_scores = {
            ErrorSeverity.CRITICAL: 1.0,
            ErrorSeverity.HIGH: 0.8,
            ErrorSeverity.MEDIUM: 0.5,
            ErrorSeverity.LOW: 0.2,
            ErrorSeverity.INFO: 0.1,
            ErrorSeverity.DEBUG: 0.0
        }
        
        impact_multipliers = {
            "System": 1.0,
            "Service": 0.8,
            "User": 0.5
        }
        
        base_score = base_scores.get(severity, 0.0)
        impact_multiplier = impact_multipliers.get(
            context.get("impact_level", "Service"),
            0.5
        )
        
        # Additional factors
        affected_components = len(context.get("affected_components", []))
        component_multiplier = min(1.0, affected_components * 0.2)
        
        requires_immediate = 1.2 if context.get("requires_immediate_action", False) else 1.0
        
        return base_score * impact_multiplier * (1 + component_multiplier) * requires_immediate
    
    def _should_create_incident(self, error_context: ErrorContext) -> bool:
        # Check error frequency
        error_count = len(self.error_cache.get(error_context.trace_id, []))
        threshold = self.error_thresholds[error_context.severity]
        
        # Check impact-based thresholds
        impact_threshold = self.impact_thresholds.get(
            error_context.impact_level,
            self.impact_thresholds["Service"]
        ).get(error_context.severity, float('inf'))
        
        return (
            error_context.severity in [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH] or
            error_count >= threshold or
            error_count >= impact_threshold or
            error_context.requires_immediate_action
        )
    
    async def _create_incident(self, error_id: str, error_context: ErrorContext):
        incident_id = f"INC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        incident = {
            "incident_id": incident_id,
            "error_id": error_id,
            "timestamp": error_context.timestamp.isoformat(),
            "severity": error_context.severity.value,
            "category": error_context.category.value,
            "source": error_context.source,
            "trace_id": error_context.trace_id,
            "user_id": error_context.user_id,
            "session_id": error_context.session_id,
            "request_id": error_context.request_id,
            "environment": error_context.environment,
            "component": error_context.component,
            "error_message": error_context.error_message,
            "status": "open",
            "assigned_to": None,
            "resolution": None,
            "resolution_time": error_context.resolution_time
        }
        
        # Cache incident
        self.incident_cache[incident_id] = incident
        
        # Write to incident log
        incident_file = f"{self.incident_path}/incidents_{datetime.utcnow().date()}.log"
        async with aiofiles.open(incident_file, mode="a") as f:
            await f.write(json.dumps(incident) + "\n")
        
        # Send incident to SIEM
        await siem_integration.send_event(
            event_type="incident",
            severity=error_context.severity.value,
            source=error_context.source,
            category=error_context.category.value,
            details=incident,
            user_id=error_context.user_id,
            session_id=error_context.session_id,
            trace_id=error_context.trace_id
        )
        
        # Record metrics
        performance_monitor.increment_counter(
            "error_incidents",
            {
                "severity": error_context.severity.value,
                "category": error_context.category.value,
                "component": error_context.component
            }
        )
        
        # Alert on critical incidents
        if error_context.severity == ErrorSeverity.CRITICAL:
            await self._alert_critical_incident(incident)
    
    async def _alert_critical_incident(self, incident: Dict[str, Any]):
        alert = {
            "type": "critical_incident",
            "incident_id": incident["incident_id"],
            "timestamp": datetime.utcnow().isoformat(),
            "severity": "critical",
            "component": incident["component"],
            "error_message": incident["error_message"]
        }
        
        # Send alert to SIEM
        await siem_integration.send_event(
            event_type="alert",
            severity="critical",
            source=incident["source"],
            category=incident["category"],
            details=alert,
            user_id=incident["user_id"],
            session_id=incident["session_id"],
            trace_id=incident["trace_id"]
        )
        
        # Record metrics
        performance_monitor.increment_counter(
            "error_alerts",
            {
                "type": "critical_incident",
                "component": incident["component"]
            }
        )
        
        logger.error(f"Critical Incident Alert: {json.dumps(alert)}")

# Initialize error reporter
error_reporter = ErrorReporter() 