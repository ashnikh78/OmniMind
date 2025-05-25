from typing import Dict, Any, Optional
import time
import asyncio
from datetime import datetime, timedelta
import logging
from app.core.config import settings
from app.core.monitoring import logger, performance_monitor

class RateLimiter:
    def __init__(self, max_requests: int, time_window: int):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = {}
        self.lock = asyncio.Lock()
    
    async def is_allowed(self, key: str) -> bool:
        async with self.lock:
            now = time.time()
            
            # Clean up old requests
            if key in self.requests:
                self.requests[key] = [
                    req_time for req_time in self.requests[key]
                    if now - req_time < self.time_window
                ]
            
            # Check if under limit
            if key not in self.requests:
                self.requests[key] = []
            
            if len(self.requests[key]) >= self.max_requests:
                return False
            
            self.requests[key].append(now)
            return True
    
    async def get_remaining(self, key: str) -> int:
        async with self.lock:
            if key not in self.requests:
                return self.max_requests
            
            now = time.time()
            self.requests[key] = [
                req_time for req_time in self.requests[key]
                if now - req_time < self.time_window
            ]
            
            return self.max_requests - len(self.requests[key])

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        reset_timeout: int = 60,
        half_open_timeout: int = 30
    ):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.half_open_timeout = half_open_timeout
        self.failures = {}
        self.last_failure_time = {}
        self.state = {}  # 'closed', 'open', 'half-open'
        self.lock = asyncio.Lock()
    
    async def is_allowed(self, key: str) -> bool:
        async with self.lock:
            now = time.time()
            
            # Initialize if not exists
            if key not in self.state:
                self.state[key] = 'closed'
                self.failures[key] = 0
                self.last_failure_time[key] = 0
            
            # Check state
            if self.state[key] == 'open':
                if now - self.last_failure_time[key] >= self.reset_timeout:
                    self.state[key] = 'half-open'
                    return True
                return False
            
            if self.state[key] == 'half-open':
                if now - self.last_failure_time[key] >= self.half_open_timeout:
                    self.state[key] = 'closed'
                    self.failures[key] = 0
                    return True
                return False
            
            return True
    
    async def record_success(self, key: str):
        async with self.lock:
            if key in self.state:
                self.state[key] = 'closed'
                self.failures[key] = 0
    
    async def record_failure(self, key: str):
        async with self.lock:
            if key not in self.failures:
                self.failures[key] = 0
            
            self.failures[key] += 1
            self.last_failure_time[key] = time.time()
            
            if self.failures[key] >= self.failure_threshold:
                self.state[key] = 'open'
                logger.warning(f"Circuit breaker opened for {key}")

class RateLimitManager:
    def __init__(self):
        self.limiters = {
            "api": RateLimiter(max_requests=100, time_window=60),  # 100 requests per minute
            "model": RateLimiter(max_requests=50, time_window=60),  # 50 model calls per minute
            "user": RateLimiter(max_requests=1000, time_window=3600)  # 1000 requests per hour
        }
        
        self.circuit_breakers = {
            "model": CircuitBreaker(failure_threshold=5, reset_timeout=60),
            "database": CircuitBreaker(failure_threshold=3, reset_timeout=30),
            "external_api": CircuitBreaker(failure_threshold=10, reset_timeout=300)
        }
    
    async def check_rate_limit(self, limiter_type: str, key: str) -> bool:
        if limiter_type not in self.limiters:
            return True
        
        return await self.limiters[limiter_type].is_allowed(key)
    
    async def check_circuit_breaker(self, breaker_type: str, key: str) -> bool:
        if breaker_type not in self.circuit_breakers:
            return True
        
        return await self.circuit_breakers[breaker_type].is_allowed(key)
    
    async def record_success(self, breaker_type: str, key: str):
        if breaker_type in self.circuit_breakers:
            await self.circuit_breakers[breaker_type].record_success(key)
    
    async def record_failure(self, breaker_type: str, key: str):
        if breaker_type in self.circuit_breakers:
            await self.circuit_breakers[breaker_type].record_failure(key)
    
    async def get_remaining_requests(self, limiter_type: str, key: str) -> int:
        if limiter_type not in self.limiters:
            return 0
        
        return await self.limiters[limiter_type].get_remaining(key)

# Initialize rate limit manager
rate_limit_manager = RateLimitManager() 