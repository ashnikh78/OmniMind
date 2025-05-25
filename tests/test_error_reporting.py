import pytest
from datetime import datetime, timedelta
import os
import json
import asyncio
from app.core.error_reporting import (
    ErrorReporter,
    ErrorSeverity,
    ErrorCategory,
    ErrorContext
)

@pytest.fixture
def error_reporter():
    return ErrorReporter()

@pytest.fixture
def test_context():
    return {
        "source": "test_source",
        "trace_id": "test_trace_123",
        "user_id": "test_user",
        "session_id": "test_session",
        "request_id": "test_request",
        "component": "test_component",
        "additional_data": {"test_key": "test_value"}
    }

async def test_report_error(error_reporter, test_context):
    error = ValueError("Test error")
    error_id = await error_reporter.report_error(
        error,
        ErrorSeverity.MEDIUM,
        ErrorCategory.SYSTEM,
        test_context
    )
    
    assert error_id is not None
    assert len(error_id) == 16
    
    # Verify error cache
    assert error_id in error_reporter.error_cache
    assert len(error_reporter.error_cache[error_id]) == 1
    
    # Verify log files
    assert os.path.exists(f"{error_reporter.log_path}/errors_{datetime.utcnow().date()}.log")
    assert os.path.exists(f"{error_reporter.siem_path}/siem_{datetime.utcnow().date()}.log")

async def test_error_threshold_incident(error_reporter, test_context):
    error = ValueError("Test error")
    
    # Report errors up to threshold
    for _ in range(error_reporter.error_thresholds[ErrorSeverity.MEDIUM]):
        await error_reporter.report_error(
            error,
            ErrorSeverity.MEDIUM,
            ErrorCategory.SYSTEM,
            test_context
        )
    
    # Verify incident creation
    assert os.path.exists(f"{error_reporter.incident_path}/incidents_{datetime.utcnow().date()}.log")
    assert len(error_reporter.incident_cache) > 0

async def test_critical_incident(error_reporter, test_context):
    error = ValueError("Critical error")
    await error_reporter.report_error(
        error,
        ErrorSeverity.CRITICAL,
        ErrorCategory.SECURITY,
        test_context
    )
    
    # Verify incident creation
    assert len(error_reporter.incident_cache) == 1
    incident = list(error_reporter.incident_cache.values())[0]
    assert incident["severity"] == ErrorSeverity.CRITICAL.value
    assert incident["category"] == ErrorCategory.SECURITY.value

async def test_error_stats(error_reporter, test_context):
    # Report errors of different severities
    await error_reporter.report_error(
        ValueError("Low error"),
        ErrorSeverity.LOW,
        ErrorCategory.USER,
        test_context
    )
    
    await error_reporter.report_error(
        ValueError("Medium error"),
        ErrorSeverity.MEDIUM,
        ErrorCategory.SYSTEM,
        test_context
    )
    
    await error_reporter.report_error(
        ValueError("High error"),
        ErrorSeverity.HIGH,
        ErrorCategory.SECURITY,
        test_context
    )
    
    # Get stats
    stats = await error_reporter.get_error_stats()
    
    assert stats["total_errors"] == 3
    assert stats["by_severity"][ErrorSeverity.LOW.value] == 1
    assert stats["by_severity"][ErrorSeverity.MEDIUM.value] == 1
    assert stats["by_severity"][ErrorSeverity.HIGH.value] == 1
    assert stats["by_category"][ErrorCategory.USER.value] == 1
    assert stats["by_category"][ErrorCategory.SYSTEM.value] == 1
    assert stats["by_category"][ErrorCategory.SECURITY.value] == 1

async def test_error_cache_cleanup(error_reporter, test_context):
    # Add old error
    old_time = datetime.utcnow() - timedelta(hours=2)
    error_context = ErrorContext(
        timestamp=old_time,
        severity=ErrorSeverity.LOW,
        category=ErrorCategory.USER,
        source=test_context["source"],
        trace_id=test_context["trace_id"],
        user_id=test_context["user_id"],
        session_id=test_context["session_id"],
        request_id=test_context["request_id"],
        environment="test",
        component=test_context["component"],
        stack_trace="",
        error_message="Old error",
        additional_data=test_context["additional_data"]
    )
    
    error_id = "test_error_id"
    error_reporter.error_cache[error_id] = [error_context]
    
    # Add new error
    await error_reporter.report_error(
        ValueError("New error"),
        ErrorSeverity.LOW,
        ErrorCategory.USER,
        test_context
    )
    
    # Verify cleanup
    assert error_id not in error_reporter.error_cache

async def test_incident_resolution(error_reporter, test_context):
    # Create incident
    error = ValueError("Test error")
    await error_reporter.report_error(
        error,
        ErrorSeverity.CRITICAL,
        ErrorCategory.SECURITY,
        test_context
    )
    
    # Get incident
    incident = list(error_reporter.incident_cache.values())[0]
    incident_id = incident["incident_id"]
    
    # Update incident
    incident["status"] = "resolved"
    incident["assigned_to"] = "test_user"
    incident["resolution"] = "Fixed the issue"
    incident["resolution_time"] = datetime.utcnow().isoformat()
    
    # Verify update
    assert error_reporter.incident_cache[incident_id]["status"] == "resolved"
    assert error_reporter.incident_cache[incident_id]["assigned_to"] == "test_user"

def test_log_directory_permissions(error_reporter):
    # Verify log directory permissions
    for path in [error_reporter.log_path, error_reporter.siem_path, error_reporter.incident_path]:
        assert os.path.exists(path)
        assert oct(os.stat(path).st_mode)[-3:] == "700" 