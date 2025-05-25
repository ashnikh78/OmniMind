import pytest
from datetime import datetime, timedelta
import time
from app.core.monitoring import (
    PerformanceMonitor,
    HealthCheck,
    AlertManager,
    REQUEST_COUNT,
    RESPONSE_TIME,
    MODEL_LATENCY,
    ERROR_COUNT,
    ACTIVE_REQUESTS,
    MEMORY_USAGE,
    CPU_USAGE
)

@pytest.fixture
def performance_monitor():
    return PerformanceMonitor()

@pytest.fixture
def health_check():
    return HealthCheck()

@pytest.fixture
def alert_manager():
    return AlertManager()

async def test_track_request(performance_monitor):
    endpoint = "test_endpoint"
    user_type = "standard"
    
    async with performance_monitor.track_request(endpoint, user_type):
        # Simulate some work
        time.sleep(0.1)
    
    # Verify metrics
    assert ACTIVE_REQUESTS.labels(endpoint=endpoint, user_type=user_type)._value.get() == 0
    assert REQUEST_COUNT.labels(endpoint=endpoint, status="success", user_type=user_type)._value.get() == 1

async def test_track_request_error(performance_monitor):
    endpoint = "test_endpoint"
    user_type = "standard"
    
    with pytest.raises(Exception):
        async with performance_monitor.track_request(endpoint, user_type):
            raise Exception("Test error")
    
    # Verify metrics
    assert ACTIVE_REQUESTS.labels(endpoint=endpoint, user_type=user_type)._value.get() == 0
    assert REQUEST_COUNT.labels(endpoint=endpoint, status="error", user_type=user_type)._value.get() == 1
    assert ERROR_COUNT.labels(endpoint=endpoint, error_type="Exception", severity="medium")._value.get() == 1

def test_track_model_performance(performance_monitor):
    model_name = "test_model"
    operation = "inference"
    latency = 0.5
    
    performance_monitor.track_model_performance(model_name, operation, latency)
    
    # Verify metrics
    assert MODEL_LATENCY.labels(model_name=model_name, operation=operation)._sum.get() == latency
    
    # Verify performance history
    stats = performance_monitor.get_model_performance_stats(model_name)
    assert stats["avg_latency"] == latency
    assert stats["max_latency"] == latency
    assert stats["min_latency"] == latency
    assert stats["request_count"] == 1

def test_performance_history_cleanup(performance_monitor):
    model_name = "test_model"
    operation = "inference"
    
    # Add old entry
    old_time = datetime.utcnow() - timedelta(hours=25)
    performance_monitor.performance_history[model_name] = [{
        "timestamp": old_time,
        "operation": operation,
        "latency": 0.5
    }]
    
    # Add new entry
    performance_monitor.track_model_performance(model_name, operation, 0.3)
    
    # Verify cleanup
    assert len(performance_monitor.performance_history[model_name]) == 1
    assert performance_monitor.performance_history[model_name][0]["latency"] == 0.3

async def test_health_check(health_check):
    # Register test component
    @health_check.register_component("test_component")
    async def test_component_check():
        return True
    
    # Check health
    results = await health_check.check_health()
    assert "test_component" in results
    assert results["test_component"]["status"] == "healthy"
    assert "latency_ms" in results["test_component"]
    assert "version" in results["test_component"]

async def test_health_check_failure(health_check):
    # Register failing component
    @health_check.register_component("failing_component")
    async def failing_component_check():
        return False
    
    # Check health
    results = await health_check.check_health()
    assert "failing_component" in results
    assert results["failing_component"]["status"] == "unhealthy"

async def test_health_check_error(health_check):
    # Register error-throwing component
    @health_check.register_component("error_component")
    async def error_component_check():
        raise Exception("Test error")
    
    # Check health
    results = await health_check.check_health()
    assert "error_component" in results
    assert results["error_component"]["status"] == "error"
    assert "error" in results["error_component"]

def test_alert_manager(alert_manager):
    # Test high latency alert
    metrics = {
        "response_time": 600,  # ms
        "error_count": 5,
        "request_count": 100,
        "model_latencies": {"model1": 1200},  # ms
        "memory_usage": 0.85,  # 85%
        "cpu_usage": 0.95  # 95%
    }
    
    alerts = alert_manager.check_alerts(metrics)
    assert len(alerts) > 0
    
    # Verify alert types
    alert_types = {alert["type"] for alert in alerts}
    assert "high_latency" in alert_types
    assert "high_error_rate" in alert_types
    assert "high_model_latency" in alert_types
    assert "high_memory_usage" in alert_types
    assert "high_cpu_usage" in alert_types

def test_alert_cooldown(alert_manager):
    metrics = {
        "response_time": 600,  # ms
        "error_count": 0,
        "request_count": 100
    }
    
    # First alert
    alerts1 = alert_manager.check_alerts(metrics)
    assert len(alerts1) > 0
    
    # Second alert (should be suppressed by cooldown)
    alerts2 = alert_manager.check_alerts(metrics)
    assert len(alerts2) == 0

def test_alert_severity(alert_manager):
    metrics = {
        "response_time": 1000,  # ms (2x threshold)
        "error_count": 0,
        "request_count": 100
    }
    
    alerts = alert_manager.check_alerts(metrics)
    assert len(alerts) > 0
    
    # Verify high severity for 2x threshold
    assert any(alert["severity"] == "high" for alert in alerts)

def test_resource_metrics():
    # Test memory usage
    MEMORY_USAGE.labels(component="test").set(1024)
    assert MEMORY_USAGE.labels(component="test")._value.get() == 1024
    
    # Test CPU usage
    CPU_USAGE.labels(component="test").set(0.5)
    assert CPU_USAGE.labels(component="test")._value.get() == 0.5 