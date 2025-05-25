from typing import Dict, Any, Optional, List
import logging
import json
import asyncio
import aiohttp
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import hashlib
from app.core.config import settings
from app.core.monitoring import logger, performance_monitor

class SIEMProvider(Enum):
    SPLUNK = "splunk"
    QRADAR = "qradar"
    ELK = "elk"
    SENTINEL = "sentinel"
    DATADOG = "datadog"
    NEW_RELIC = "new_relic"
    DYNA_TRACE = "dynatrace"
    SUMO_LOGIC = "sumo_logic"
    GRAYLOG = "graylog"
    CUSTOM = "custom"

@dataclass
class SIEMEvent:
    event_id: str
    timestamp: datetime
    event_type: str
    severity: str
    source: str
    category: str
    details: Dict[str, Any]
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    device_id: Optional[str] = None
    session_id: Optional[str] = None
    trace_id: Optional[str] = None
    correlation_id: Optional[str] = None
    tags: Optional[List[str]] = None
    metrics: Optional[Dict[str, float]] = None

class SIEMIntegration:
    def __init__(self):
        self.providers = {}
        self.event_queue = asyncio.Queue()
        self.initialized = False
        self._initialize_providers()
        self._start_event_processor()
        
        # Register metrics
        performance_monitor.register_metric("siem_events_sent", "counter")
        performance_monitor.register_metric("siem_events_failed", "counter")
        performance_monitor.register_metric("siem_events_queued", "gauge")
        performance_monitor.register_metric("siem_events_processed", "counter")
        performance_monitor.register_metric("siem_events_dropped", "counter")
        performance_monitor.register_metric("siem_events_retried", "counter")
        performance_monitor.register_metric("siem_provider_latency", "histogram")
    
    def _initialize_providers(self):
        """Initialize configured SIEM providers"""
        for provider in settings.siem.PROVIDERS:
            try:
                if provider["type"] == SIEMProvider.SPLUNK:
                    self.providers[provider["name"]] = SplunkProvider(provider["config"])
                elif provider["type"] == SIEMProvider.QRADAR:
                    self.providers[provider["name"]] = QRadarProvider(provider["config"])
                elif provider["type"] == SIEMProvider.ELK:
                    self.providers[provider["name"]] = ELKProvider(provider["config"])
                elif provider["type"] == SIEMProvider.SENTINEL:
                    self.providers[provider["name"]] = SentinelProvider(provider["config"])
                elif provider["type"] == SIEMProvider.DATADOG:
                    self.providers[provider["name"]] = DatadogProvider(provider["config"])
                elif provider["type"] == SIEMProvider.NEW_RELIC:
                    self.providers[provider["name"]] = NewRelicProvider(provider["config"])
                elif provider["type"] == SIEMProvider.DYNA_TRACE:
                    self.providers[provider["name"]] = DynatraceProvider(provider["config"])
                elif provider["type"] == SIEMProvider.SUMO_LOGIC:
                    self.providers[provider["name"]] = SumoLogicProvider(provider["config"])
                elif provider["type"] == SIEMProvider.GRAYLOG:
                    self.providers[provider["name"]] = GraylogProvider(provider["config"])
                elif provider["type"] == SIEMProvider.CUSTOM:
                    self.providers[provider["name"]] = CustomProvider(provider["config"])
            except Exception as e:
                logger.error(f"Failed to initialize SIEM provider {provider['name']}: {e}")
        
        self.initialized = True
    
    def _start_event_processor(self):
        """Start background event processing"""
        asyncio.create_task(self._process_events())
    
    async def _process_events(self):
        """Process events from the queue and send to SIEM providers"""
        batch = []
        last_send = datetime.utcnow()
        
        while True:
            try:
                # Get event with timeout
                try:
                    event = await asyncio.wait_for(
                        self.event_queue.get(),
                        timeout=settings.siem.BATCH_INTERVAL
                    )
                    batch.append(event)
                except asyncio.TimeoutError:
                    pass
                
                # Check if we should send the batch
                current_time = datetime.utcnow()
                if (
                    len(batch) >= settings.siem.BATCH_SIZE or
                    (batch and (current_time - last_send).total_seconds() >= settings.siem.BATCH_INTERVAL)
                ):
                    await self._send_batch(batch)
                    batch = []
                    last_send = current_time
                
                if event:
                    self.event_queue.task_done()
                    performance_monitor.increment_counter("siem_events_processed")
            
            except Exception as e:
                logger.error(f"Error processing SIEM events: {e}")
                performance_monitor.increment_counter("siem_events_failed")
                # Clear batch on error
                batch = []
    
    async def _send_batch(self, events: List[SIEMEvent]):
        """Send a batch of events to all providers"""
        for provider_name, provider in self.providers.items():
            try:
                start_time = datetime.utcnow()
                await provider.send_batch(events)
                latency = (datetime.utcnow() - start_time).total_seconds()
                
                performance_monitor.observe_histogram(
                    "siem_provider_latency",
                    latency,
                    {"provider": provider_name}
                )
                
                performance_monitor.increment_counter(
                    "siem_events_sent",
                    {"provider": provider_name, "count": len(events)}
                )
            except Exception as e:
                logger.error(f"Error sending batch to {provider_name}: {e}")
                performance_monitor.increment_counter(
                    "siem_events_failed",
                    {"provider": provider_name, "count": len(events)}
                )
                
                # Retry individual events
                for event in events:
                    try:
                        await provider.send_event(event)
                        performance_monitor.increment_counter(
                            "siem_events_retried",
                            {"provider": provider_name}
                        )
                    except Exception as retry_error:
                        logger.error(f"Failed to retry event for {provider_name}: {retry_error}")
                        performance_monitor.increment_counter(
                            "siem_events_dropped",
                            {"provider": provider_name}
                        )

    async def send_event(
        self,
        event_type: str,
        severity: str,
        source: str,
        category: str,
        details: Dict[str, Any],
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        device_id: Optional[str] = None,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None
    ):
        """Send an event to all configured SIEM providers"""
        if not self.initialized:
            logger.warning("SIEM integration not initialized")
            return
        
        event = SIEMEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.utcnow(),
            event_type=event_type,
            severity=severity,
            source=source,
            category=category,
            details=details,
            user_id=user_id,
            ip_address=ip_address,
            device_id=device_id,
            session_id=session_id,
            trace_id=trace_id
        )
        
        await self.event_queue.put(event)
        performance_monitor.set_gauge(
            "siem_events_queued",
            self.event_queue.qsize()
        )
    
    def _generate_event_id(self) -> str:
        """Generate a unique event ID"""
        return hashlib.sha256(
            f"{datetime.utcnow().isoformat()}{hashlib.sha256().hexdigest()}".encode()
        ).hexdigest()[:16]

class BaseSIEMProvider:
    """Base class for SIEM providers"""
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.session = None
    
    async def initialize(self):
        """Initialize provider connection"""
        pass
    
    async def send_event(self, event: SIEMEvent):
        """Send event to SIEM provider"""
        raise NotImplementedError
    
    async def close(self):
        """Close provider connection"""
        if self.session:
            await self.session.close()

class SplunkProvider(BaseSIEMProvider):
    """Splunk SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "Authorization": f"Bearer {self.config['token']}",
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "event": event.details,
            "sourcetype": event.source,
            "source": event.category,
            "host": self.config["host"],
            "time": event.timestamp.timestamp()
        }
        
        async with self.session.post("/services/collector/event", json=payload) as response:
            if response.status != 200:
                raise Exception(f"Splunk API error: {await response.text()}")

class QRadarProvider(BaseSIEMProvider):
    """QRadar SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "SEC": self.config["token"],
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "event": event.details,
            "source": event.source,
            "category": event.category,
            "severity": event.severity,
            "timestamp": event.timestamp.timestamp()
        }
        
        async with self.session.post("/api/events", json=payload) as response:
            if response.status != 200:
                raise Exception(f"QRadar API error: {await response.text()}")

class ELKProvider(BaseSIEMProvider):
    """ELK Stack SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "Authorization": f"Basic {self.config['auth']}",
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "event": event.details,
            "source": event.source,
            "category": event.category,
            "severity": event.severity,
            "@timestamp": event.timestamp.isoformat()
        }
        
        async with self.session.post(
            f"/{self.config['index']}/_doc",
            json=payload
        ) as response:
            if response.status != 201:
                raise Exception(f"ELK API error: {await response.text()}")

class SentinelProvider(BaseSIEMProvider):
    """Azure Sentinel SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "Authorization": f"Bearer {self.config['token']}",
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "event": event.details,
            "source": event.source,
            "category": event.category,
            "severity": event.severity,
            "timestamp": event.timestamp.isoformat()
        }
        
        async with self.session.post(
            f"/subscriptions/{self.config['subscription']}/resourceGroups/{self.config['resource_group']}/providers/Microsoft.OperationalInsights/workspaces/{self.config['workspace']}/api/query",
            json=payload
        ) as response:
            if response.status != 200:
                raise Exception(f"Sentinel API error: {await response.text()}")

class CustomProvider(BaseSIEMProvider):
    """Custom SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers=self.config.get("headers", {}),
            **self.config.get("session_options", {})
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        # Use custom event formatter if provided
        if "formatter" in self.config:
            payload = self.config["formatter"](event)
        else:
            payload = {
                "event": event.details,
                "source": event.source,
                "category": event.category,
                "severity": event.severity,
                "timestamp": event.timestamp.isoformat()
            }
        
        async with self.session.post(
            self.config["endpoint"],
            json=payload
        ) as response:
            if response.status != self.config.get("success_status", 200):
                raise Exception(f"Custom SIEM API error: {await response.text()}")

class DatadogProvider(BaseSIEMProvider):
    """Datadog SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "DD-API-KEY": self.config["api_key"],
                "DD-APPLICATION-KEY": self.config["app_key"],
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "title": f"{event.event_type} - {event.severity}",
            "text": event.details.get("error_message", ""),
            "priority": self._map_severity(event.severity),
            "tags": event.tags or [],
            "host": self.config["host"],
            "source": event.source,
            "timestamp": event.timestamp.timestamp()
        }
        
        async with self.session.post("/api/v1/events", json=payload) as response:
            if response.status != 202:
                raise Exception(f"Datadog API error: {await response.text()}")
    
    def _map_severity(self, severity: str) -> str:
        severity_map = {
            "critical": "high",
            "high": "high",
            "medium": "normal",
            "low": "low"
        }
        return severity_map.get(severity.lower(), "normal")

class NewRelicProvider(BaseSIEMProvider):
    """New Relic SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "X-Insert-Key": self.config["insert_key"],
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "eventType": event.event_type,
            "severity": event.severity,
            "source": event.source,
            "category": event.category,
            "timestamp": event.timestamp.timestamp(),
            "attributes": {
                **event.details,
                "user_id": event.user_id,
                "session_id": event.session_id,
                "trace_id": event.trace_id
            }
        }
        
        async with self.session.post("/v1/accounts/events", json=payload) as response:
            if response.status != 202:
                raise Exception(f"New Relic API error: {await response.text()}")

class DynatraceProvider(BaseSIEMProvider):
    """Dynatrace SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "Authorization": f"Api-Token {self.config['token']}",
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "eventType": event.event_type,
            "severity": event.severity,
            "source": event.source,
            "category": event.category,
            "timestamp": event.timestamp.timestamp(),
            "properties": {
                **event.details,
                "user_id": event.user_id,
                "session_id": event.session_id,
                "trace_id": event.trace_id
            }
        }
        
        async with self.session.post("/api/v2/events", json=payload) as response:
            if response.status != 201:
                raise Exception(f"Dynatrace API error: {await response.text()}")

class SumoLogicProvider(BaseSIEMProvider):
    """Sumo Logic SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "Authorization": f"Basic {self.config['auth']}",
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "event": event.details,
            "source": event.source,
            "category": event.category,
            "severity": event.severity,
            "timestamp": event.timestamp.timestamp(),
            "metadata": {
                "user_id": event.user_id,
                "session_id": event.session_id,
                "trace_id": event.trace_id
            }
        }
        
        async with self.session.post("/api/v1/logs", json=payload) as response:
            if response.status != 200:
                raise Exception(f"Sumo Logic API error: {await response.text()}")

class GraylogProvider(BaseSIEMProvider):
    """Graylog SIEM provider implementation"""
    async def initialize(self):
        self.session = aiohttp.ClientSession(
            base_url=self.config["url"],
            headers={
                "Authorization": f"Basic {self.config['auth']}",
                "Content-Type": "application/json"
            }
        )
    
    async def send_event(self, event: SIEMEvent):
        if not self.session:
            await self.initialize()
        
        payload = {
            "message": event.details.get("error_message", ""),
            "source": event.source,
            "level": self._map_severity(event.severity),
            "timestamp": event.timestamp.timestamp(),
            "fields": {
                **event.details,
                "event_type": event.event_type,
                "category": event.category,
                "user_id": event.user_id,
                "session_id": event.session_id,
                "trace_id": event.trace_id
            }
        }
        
        async with self.session.post("/api/gelf", json=payload) as response:
            if response.status != 202:
                raise Exception(f"Graylog API error: {await response.text()}")
    
    def _map_severity(self, severity: str) -> int:
        severity_map = {
            "critical": 0,
            "high": 1,
            "medium": 2,
            "low": 3
        }
        return severity_map.get(severity.lower(), 3)

# Initialize SIEM integration
siem_integration = SIEMIntegration() 