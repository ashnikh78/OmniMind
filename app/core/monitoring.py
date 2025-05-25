from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.prometheus import PrometheusMetricsExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_client import Counter, Histogram, Gauge, Summary
import time
from typing import Dict, Any, Optional, List, Deque
from collections import deque
import logging
import json
from datetime import datetime, timedelta
import asyncio
from app.core.config import settings
import threading
from concurrent.futures import ThreadPoolExecutor

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, settings.monitoring.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize OpenTelemetry with secure configuration
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# Enhanced Prometheus metrics with optimized buckets
REQUEST_COUNT = Counter(
    'omnimind_request_total',
    'Total number of requests',
    ['endpoint', 'status', 'user_type']
)

RESPONSE_TIME = Histogram(
    'omnimind_response_time_seconds',
    'Response time in seconds',
    ['endpoint', 'method'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]  # More granular buckets
)

MODEL_LATENCY = Histogram(
    'omnimind_model_latency_seconds',
    'Model inference latency in seconds',
    ['model_name', 'operation'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]  # More granular buckets
)

ERROR_COUNT = Counter(
    'omnimind_error_total',
    'Total number of errors',
    ['endpoint', 'error_type', 'severity']
)

ACTIVE_REQUESTS = Gauge(
    'omnimind_active_requests',
    'Number of active requests',
    ['endpoint', 'user_type']
)

MEMORY_USAGE = Gauge(
    'omnimind_memory_usage_bytes',
    'Memory usage in bytes',
    ['component']
)

CPU_USAGE = Gauge(
    'omnimind_cpu_usage_percent',
    'CPU usage percentage',
    ['component']
)

# New metrics for enhanced monitoring
DISK_USAGE = Gauge(
    'omnimind_disk_usage_bytes',
    'Disk usage in bytes',
    ['component', 'mount_point']
)

NETWORK_TRAFFIC = Gauge(
    'omnimind_network_traffic_bytes',
    'Network traffic in bytes',
    ['component', 'direction', 'interface']
)

API_LATENCY = Histogram(
    'omnimind_api_latency_seconds',
    'API endpoint latency in seconds',
    ['endpoint', 'method']
)

ERROR_RATE = Gauge(
    'omnimind_error_rate',
    'Error rate per component',
    ['component', 'error_type']
)

CACHE_HIT_RATIO = Gauge(
    'omnimind_cache_hit_ratio',
    'Cache hit ratio',
    ['cache_name']
)

DATABASE_CONNECTIONS = Gauge(
    'omnimind_db_connections',
    'Number of active database connections',
    ['database']
)

QUEUE_LENGTH = Gauge(
    'omnimind_queue_length',
    'Length of processing queues',
    ['queue_name']
)

MODEL_PERFORMANCE = Gauge(
    'omnimind_model_performance',
    'Model performance metrics',
    ['model_name', 'metric']
)

class PerformanceMonitor:
    def __init__(self):
        self.metrics_exporter = PrometheusMetricsExporter()
        self.span_processor = BatchSpanProcessor(self.metrics_exporter)
        trace.get_tracer_provider().add_span_processor(self.span_processor)
        self.performance_history = {}
        self.alert_thresholds = {
            "response_time": 500,  # ms
            "error_rate": 0.01,    # 1%
            "memory_usage": 0.8,   # 80%
            "cpu_usage": 0.9       # 90%
        }
        self._initialize_caches()
        self._start_background_tasks()
    
    def _initialize_caches(self):
        # Initialize thread-safe caches
        self.metric_cache = {}
        self.alert_cache = {}
        self.health_cache = {}
        self.cache_lock = threading.Lock()
        
        # Initialize performance history with thread-safe deque
        self.performance_history = {
            "response_times": deque(maxlen=1000),
            "error_rates": deque(maxlen=1000),
            "memory_usage": deque(maxlen=1000),
            "cpu_usage": deque(maxlen=1000)
        }
    
    def _start_background_tasks(self):
        # Start background tasks for cache cleanup and metric aggregation
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.executor.submit(self._cleanup_old_metrics)
        self.executor.submit(self._aggregate_metrics)
    
    def _cleanup_old_metrics(self):
        while True:
            try:
                with self.cache_lock:
                    current_time = time.time()
                    # Clean up old metrics
                    for key in list(self.metric_cache.keys()):
                        if current_time - self.metric_cache[key]["timestamp"] > 3600:  # 1 hour
                            del self.metric_cache[key]
            except Exception as e:
                logger.error(f"Error in metric cleanup: {e}")
            time.sleep(300)  # Run every 5 minutes
    
    def _aggregate_metrics(self):
        while True:
            try:
                with self.cache_lock:
                    # Aggregate metrics for reporting
                    self._calculate_percentiles()
                    self._update_health_indicators()
            except Exception as e:
                logger.error(f"Error in metric aggregation: {e}")
            time.sleep(60)  # Run every minute
    
    def _calculate_percentiles(self):
        # Calculate percentiles for response times
        if self.performance_history["response_times"]:
            sorted_times = sorted(self.performance_history["response_times"])
            p50 = sorted_times[int(len(sorted_times) * 0.5)]
            p90 = sorted_times[int(len(sorted_times) * 0.9)]
            p99 = sorted_times[int(len(sorted_times) * 0.99)]
            
            self.metric_cache["response_time_percentiles"] = {
                "p50": p50,
                "p90": p90,
                "p99": p99,
                "timestamp": time.time()
            }
    
    def _update_health_indicators(self):
        # Update health indicators based on metrics
        if self.performance_history["error_rates"]:
            recent_error_rate = sum(self.performance_history["error_rates"][-100:]) / 100
            self.health_cache["error_rate_health"] = {
                "value": recent_error_rate,
                "status": "healthy" if recent_error_rate < self.alert_thresholds["error_rate"] else "unhealthy",
                "timestamp": time.time()
            }
    
    async def track_request(self, endpoint: str, user_type: str = "standard"):
        ACTIVE_REQUESTS.labels(endpoint=endpoint, user_type=user_type).inc()
        start_time = time.time()
        
        try:
            yield
            REQUEST_COUNT.labels(
                endpoint=endpoint,
                status='success',
                user_type=user_type
            ).inc()
        except Exception as e:
            REQUEST_COUNT.labels(
                endpoint=endpoint,
                status='error',
                user_type=user_type
            ).inc()
            ERROR_COUNT.labels(
                endpoint=endpoint,
                error_type=type(e).__name__,
                severity='high' if isinstance(e, (SystemError, MemoryError)) else 'medium'
            ).inc()
            raise
        finally:
            ACTIVE_REQUESTS.labels(endpoint=endpoint, user_type=user_type).dec()
            response_time = time.time() - start_time
            RESPONSE_TIME.labels(
                endpoint=endpoint,
                method='POST'
            ).observe(response_time)
            
            # Update performance history
            with self.cache_lock:
                self.performance_history["response_times"].append(response_time)
    
    def track_model_performance(self, model_name: str, operation: str, latency: float):
        MODEL_LATENCY.labels(
            model_name=model_name,
            operation=operation
        ).observe(latency)
        
        # Update performance history with thread-safe operation
        with self.cache_lock:
            if model_name not in self.performance_history:
                self.performance_history[model_name] = deque(maxlen=1000)
            
            self.performance_history[model_name].append({
                "timestamp": datetime.utcnow(),
                "operation": operation,
                "latency": latency
            })
    
    def get_model_performance_stats(self, model_name: str) -> Dict[str, Any]:
        with self.cache_lock:
            if model_name not in self.performance_history:
                return {}
            
            latencies = [entry["latency"] for entry in self.performance_history[model_name]]
            if not latencies:
                return {}
            
            return {
                "avg_latency": sum(latencies) / len(latencies),
                "max_latency": max(latencies),
                "min_latency": min(latencies),
                "p50_latency": sorted(latencies)[int(len(latencies) * 0.5)],
                "p90_latency": sorted(latencies)[int(len(latencies) * 0.9)],
                "p99_latency": sorted(latencies)[int(len(latencies) * 0.99)],
                "request_count": len(latencies)
            }

class HealthCheck:
    def __init__(self):
        self.components = {}
        self.last_check = {}
        self.check_interval = 60  # seconds
        self.last_run = {}
        self.health_cache = {}
        self.cache_lock = threading.Lock()
    
    def register_component(self, name: str, check_func):
        self.components[name] = check_func
    
    async def check_health(self) -> Dict[str, Any]:
        results = {}
        current_time = time.time()
        
        # Check cache first
        with self.cache_lock:
            for name, cached_result in self.health_cache.items():
                if current_time - cached_result["timestamp"] < self.check_interval:
                    results[name] = cached_result["data"]
                    continue
        
        for name, check_func in self.components.items():
            # Skip if last check was too recent
            if name in self.last_run and current_time - self.last_run[name] < self.check_interval:
                results[name] = self.last_check[name]
                continue
            
            try:
                start_time = time.time()
                status = await check_func()
                latency = time.time() - start_time
                
                result = {
                    "status": "healthy" if status else "unhealthy",
                    "latency_ms": round(latency * 1000, 2),
                    "last_check": current_time,
                    "version": settings.API_VERSION
                }
                
                results[name] = result
                self.last_check[name] = result
                self.last_run[name] = current_time
                
                # Update cache
                with self.cache_lock:
                    self.health_cache[name] = {
                        "data": result,
                        "timestamp": current_time
                    }
                
                # Alert if unhealthy
                if not status:
                    await self._alert_unhealthy_component(name, result)
            
            except Exception as e:
                result = {
                    "status": "error",
                    "error": str(e),
                    "last_check": current_time,
                    "version": settings.API_VERSION
                }
                results[name] = result
                self.last_check[name] = result
                self.last_run[name] = current_time
                
                logger.error(f"Health check failed for {name}: {e}")
                await self._alert_unhealthy_component(name, result)
        
        return results

class AlertManager:
    def __init__(self):
        self.thresholds = {
            "response_time": 500,  # ms
            "error_rate": 0.01,    # 1%
            "model_latency": 1000,  # ms
            "memory_usage": 0.8,   # 80%
            "cpu_usage": 0.9       # 90%
        }
        self.alert_history = deque(maxlen=1000)
        self.alert_cooldown = 300  # 5 minutes
        self.last_alert_time = {}
        self.alert_cache = {}
        self.cache_lock = threading.Lock()
    
    def check_alerts(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        current_time = time.time()
        alerts = []
        
        # Check cache first
        with self.cache_lock:
            for alert_type, cached_alert in self.alert_cache.items():
                if current_time - cached_alert["timestamp"] < self.alert_cooldown:
                    continue
        
        # Check response time
        if metrics.get("response_time", 0) > self.thresholds["response_time"]:
            alert = self._create_alert(
                "high_latency",
                "api",
                metrics["response_time"],
                self.thresholds["response_time"]
            )
            if self._should_trigger_alert(alert["type"]):
                alerts.append(alert)
                self._update_alert_cache(alert)
        
        # Check error rate
        error_rate = metrics.get("error_count", 0) / max(metrics.get("request_count", 1), 1)
        if error_rate > self.thresholds["error_rate"]:
            alert = self._create_alert(
                "high_error_rate",
                "api",
                error_rate,
                self.thresholds["error_rate"]
            )
            if self._should_trigger_alert(alert["type"]):
                alerts.append(alert)
                self._update_alert_cache(alert)
        
        # Check model latency
        for model, latency in metrics.get("model_latencies", {}).items():
            if latency > self.thresholds["model_latency"]:
                alert = self._create_alert(
                    "high_model_latency",
                    f"model_{model}",
                    latency,
                    self.thresholds["model_latency"]
                )
                if self._should_trigger_alert(alert["type"]):
                    alerts.append(alert)
                    self._update_alert_cache(alert)
        
        # Check resource usage
        if metrics.get("memory_usage", 0) > self.thresholds["memory_usage"]:
            alert = self._create_alert(
                "high_memory_usage",
                "system",
                metrics["memory_usage"],
                self.thresholds["memory_usage"]
            )
            if self._should_trigger_alert(alert["type"]):
                alerts.append(alert)
                self._update_alert_cache(alert)
        
        if metrics.get("cpu_usage", 0) > self.thresholds["cpu_usage"]:
            alert = self._create_alert(
                "high_cpu_usage",
                "system",
                metrics["cpu_usage"],
                self.thresholds["cpu_usage"]
            )
            if self._should_trigger_alert(alert["type"]):
                alerts.append(alert)
                self._update_alert_cache(alert)
        
        if alerts:
            self.alert_history.extend(alerts)
            logger.warning(f"Alerts triggered: {json.dumps(alerts)}")
        
        return alerts
    
    def _update_alert_cache(self, alert: Dict[str, Any]):
        with self.cache_lock:
            self.alert_cache[alert["type"]] = {
                "data": alert,
                "timestamp": time.time()
            }
    
    def _should_trigger_alert(self, alert_type: str) -> bool:
        current_time = time.time()
        with self.cache_lock:
            if alert_type in self.last_alert_time:
                if current_time - self.last_alert_time[alert_type] < self.alert_cooldown:
                    return False
            
            self.last_alert_time[alert_type] = current_time
            return True

# Initialize monitoring components
performance_monitor = PerformanceMonitor()
health_check = HealthCheck()
alert_manager = AlertManager()

# Register health checks
@health_check.register_component("model_orchestrator")
async def check_model_orchestrator():
    # Implement model orchestrator health check
    return True

@health_check.register_component("knowledge_engine")
async def check_knowledge_engine():
    # Implement knowledge engine health check
    return True

@health_check.register_component("voice_pipeline")
async def check_voice_pipeline():
    # Implement voice pipeline health check
    return True 