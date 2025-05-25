import time
import asyncio
from typing import Dict, Optional, List, Any
from pydantic import BaseModel
import ollama
from dataclasses import dataclass
from collections import deque
import numpy as np
import torch
import mmap
import os
from app.core.config import settings
from app.core.monitoring import performance_monitor

@dataclass
class QueryAnalysis:
    urgency: str
    complexity: float
    context: Dict[str, any]
    user_profile: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None
    model_preference: Optional[str] = None

class ModelMetrics:
    def __init__(self, window_size: int = 1000):
        self.latency_history = deque(maxlen=window_size)
        self.error_rates = {}
        self.token_usage = {}
        self.cost_tracking = {}
        self.performance_scores = {}
        self.gpu_memory_usage = {}
        self.cpu_memory_usage = {}
    
    def update_latency(self, model: str, latency: float):
        self.latency_history.append((model, latency))
        if model not in self.performance_scores:
            self.performance_scores[model] = []
        self.performance_scores[model].append(latency)
        performance_monitor.record_latency(model, latency)
    
    def update_memory_usage(self, model: str):
        if torch.cuda.is_available():
            self.gpu_memory_usage[model] = torch.cuda.memory_allocated()
        self.cpu_memory_usage[model] = os.getpid().memory_info().rss
    
    def get_average_latency(self, model: str) -> float:
        model_latencies = [lat for mod, lat in self.latency_history if mod == model]
        return np.mean(model_latencies) if model_latencies else float('inf')
    
    def update_error_rate(self, model: str, error: bool):
        if model not in self.error_rates:
            self.error_rates[model] = {"errors": 0, "total": 0}
        self.error_rates[model]["total"] += 1
        if error:
            self.error_rates[model]["errors"] += 1
            performance_monitor.record_error(model)
    
    def get_error_rate(self, model: str) -> float:
        if model not in self.error_rates:
            return 0.0
        stats = self.error_rates[model]
        return stats["errors"] / stats["total"] if stats["total"] > 0 else 0.0

class MemoryMappedModel:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self._mmap = None
        self._model_data = None
    
    def load(self):
        if not self._mmap:
            with open(self.model_path, 'rb') as f:
                self._mmap = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
                self._model_data = self._mmap.read()
    
    def unload(self):
        if self._mmap:
            self._mmap.close()
            self._mmap = None
            self._model_data = None

class OllamaModel:
    def __init__(self, model_name: str):
        self.model_name = model_name
        self.client = ollama.Client(host=settings.OLLAMA_HOST)
        self._loaded = False
        self._last_used = time.time()
        self._concurrent_requests = 0
        self._memory_mapped = MemoryMappedModel(f"models/{model_name}.bin")
        self._gpu_enabled = torch.cuda.is_available()
    
    async def warm_up(self):
        if not self._loaded:
            try:
                # Load model into memory-mapped file
                self._memory_mapped.load()
                
                # Initialize GPU acceleration if available
                if self._gpu_enabled:
                    torch.cuda.empty_cache()
                    torch.cuda.set_device(0)  # Use first GPU
                
                # Warm up with a small prompt
                await self.client.generate(
                    model=self.model_name,
                    prompt="warmup",
                    options={
                        "num_gpu": 1 if self._gpu_enabled else 0,
                        "num_thread": settings.model.NUM_THREADS
                    }
                )
                self._loaded = True
            except Exception as e:
                print(f"Error warming up model {self.model_name}: {e}")
                self._loaded = False
    
    def unload(self):
        self._loaded = False
        self._last_used = time.time()
        self._memory_mapped.unload()
        if self._gpu_enabled:
            torch.cuda.empty_cache()
    
    async def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        start_time = time.time()
        try:
            self._concurrent_requests += 1
            
            # Add GPU acceleration options
            if self._gpu_enabled:
                kwargs["options"] = {
                    "num_gpu": 1,
                    "num_thread": settings.model.NUM_THREADS,
                    "batch_size": settings.model.BATCH_SIZE
                }
            
            response = await self.client.generate(
                model=self.model_name,
                prompt=prompt,
                **kwargs
            )
            
            latency = time.time() - start_time
            return {
                "response": response["response"],
                "latency": latency,
                "error": False,
                "gpu_memory": torch.cuda.memory_allocated() if self._gpu_enabled else 0
            }
        except Exception as e:
            return {
                "response": None,
                "latency": time.time() - start_time,
                "error": True,
                "error_message": str(e)
            }
        finally:
            self._concurrent_requests -= 1

class AdaptiveLoadBalancer:
    def __init__(self, max_concurrent: int = 5):
        self.model_loads = {}
        self.max_concurrent = max_concurrent
        self.metrics = ModelMetrics()
        self.gpu_memory_threshold = settings.model.GPU_MEMORY_THRESHOLD
    
    async def get_available(self, model_type: str) -> OllamaModel:
        model = OllamaModel(model_type)
        
        # Check GPU memory availability
        if torch.cuda.is_available():
            gpu_memory = torch.cuda.memory_allocated()
            if gpu_memory > self.gpu_memory_threshold:
                # Find model with lowest GPU memory usage
                available_models = [
                    m for m in self.model_loads.values()
                    if m._concurrent_requests < self.max_concurrent
                ]
                if available_models:
                    return min(available_models, key=lambda m: m._gpu_memory_usage)
        
        # Check if model is overloaded
        if model._concurrent_requests >= self.max_concurrent:
            # Find alternative model with lowest load
            available_models = [
                m for m in self.model_loads.values()
                if m._concurrent_requests < self.max_concurrent
            ]
            if available_models:
                return min(available_models, key=lambda m: m._concurrent_requests)
        
        self.model_loads[model_type] = model
        return model

class FallbackStrategy:
    def __init__(self, threshold: float = 0.8):
        self.threshold = threshold
        self.fallback_chain = ["balanced", "fast", "tinyllama"]
        self.fallback_history = {}
        self.performance_thresholds = {
            "latency": 500,  # 500ms
            "error_rate": 0.1,  # 10%
            "memory_usage": 0.9  # 90% of available memory
        }
    
    def should_fallback(self, metrics: ModelMetrics, model: str) -> bool:
        # Check error rate
        error_rate = metrics.get_error_rate(model)
        if error_rate > self.performance_thresholds["error_rate"]:
            self._record_fallback(model, "error_rate", error_rate)
            return True
        
        # Check latency
        avg_latency = metrics.get_average_latency(model)
        if avg_latency > self.performance_thresholds["latency"]:
            self._record_fallback(model, "latency", avg_latency)
            return True
        
        # Check memory usage
        if model in metrics.gpu_memory_usage:
            gpu_memory = metrics.gpu_memory_usage[model]
            if gpu_memory > self.performance_thresholds["memory_usage"] * torch.cuda.get_device_properties(0).total_memory:
                self._record_fallback(model, "memory", gpu_memory)
                return True
        
        return False
    
    def _record_fallback(self, model: str, reason: str, value: float):
        if model not in self.fallback_history:
            self.fallback_history[model] = []
        self.fallback_history[model].append({
            "reason": reason,
            "value": value,
            "timestamp": time.time()
        })
    
    def get_fallback_stats(self, model: str) -> Dict[str, Any]:
        if model not in self.fallback_history:
            return {
                "total_fallbacks": 0,
                "reasons": {},
                "last_fallback": None
            }
        
        history = self.fallback_history[model]
        reasons = {}
        for entry in history:
            reason = entry["reason"]
            if reason not in reasons:
                reasons[reason] = 0
            reasons[reason] += 1
        
        return {
            "total_fallbacks": len(history),
            "reasons": reasons,
            "last_fallback": history[-1] if history else None
        }
    
    def adjust_thresholds(self, model: str):
        """Dynamically adjust performance thresholds based on historical data"""
        if model not in self.fallback_history:
            return
        
        history = self.fallback_history[model]
        if not history:
            return
        
        # Calculate moving averages
        recent_history = history[-100:]  # Last 100 fallbacks
        latency_values = [h["value"] for h in recent_history if h["reason"] == "latency"]
        error_values = [h["value"] for h in recent_history if h["reason"] == "error_rate"]
        memory_values = [h["value"] for h in recent_history if h["reason"] == "memory"]
        
        if latency_values:
            self.performance_thresholds["latency"] = np.mean(latency_values) * 1.2  # 20% buffer
        if error_values:
            self.performance_thresholds["error_rate"] = np.mean(error_values) * 1.2
        if memory_values:
            self.performance_thresholds["memory_usage"] = np.mean(memory_values) * 1.2

class ModelOrchestrator:
    def __init__(self):
        self.models = {
            "fast": OllamaModel("tinyllama"),
            "balanced": OllamaModel("llama2-7b"),
            "precise": OllamaModel("llama2-70b"),
            "coding": OllamaModel("codellama")
        }
        self.load_balancer = AdaptiveLoadBalancer(
            max_concurrent=settings.model.MAX_CONCURRENT
        )
        self.current_model = "balanced"
        self.metrics = ModelMetrics(
            window_size=settings.model.PERFORMANCE_WINDOW
        )
        self.fallback = FallbackStrategy(
            threshold=settings.model.FALLBACK_THRESHOLD
        )
        
        # Initialize performance monitoring
        performance_monitor.register_metric("model_latency", "histogram")
        performance_monitor.register_metric("model_errors", "counter")
        performance_monitor.register_metric("gpu_memory_usage", "gauge")
    
    async def select_model(self, query: QueryAnalysis) -> OllamaModel:
        start_time = time.time()
        
        # Check user preference first
        if query.model_preference and query.model_preference in self.models:
            selected = self.models[query.model_preference]
        # Real-time decision making with performance metrics
        elif query.urgency == "high":
            selected = self.models["fast"]
        elif query.complexity > 0.7:
            selected = await self.load_balancer.get_available("precise")
        else:
            selected = self.models["balanced"]
        
        # Check if fallback is needed
        if self.fallback.should_fallback(self.metrics, selected.model_name):
            for fallback_model in self.fallback.fallback_chain:
                if fallback_model != selected.model_name:
                    selected = self.models[fallback_model]
                    break
        
        # Ensure model is warmed up
        await selected.warm_up()
        
        # Update memory usage metrics
        self.metrics.update_memory_usage(selected.model_name)
        
        # Log selection time
        selection_time = time.time() - start_time
        if selection_time > 0.05:  # 50ms threshold
            print(f"Warning: Model selection took {selection_time*1000:.2f}ms")
        
        return selected
    
    async def hot_swap(self, current_model: str, new_model: str) -> str:
        start_time = time.time()
        
        if current_model in self.models:
            self.models[current_model].unload()
        
        if new_model in self.models:
            await self.models[new_model].warm_up()
            self.current_model = new_model
        
        swap_time = time.time() - start_time
        return f"Switched to {new_model} in {swap_time*1000:.2f}ms"
    
    async def generate_response(
        self,
        prompt: str,
        query_analysis: QueryAnalysis
    ) -> Dict[str, Any]:
        model = await self.select_model(query_analysis)
        result = await model.generate(prompt)
        
        # Update metrics
        self.metrics.update_latency(model.model_name, result["latency"])
        self.metrics.update_error_rate(model.model_name, result["error"])
        self.metrics.update_memory_usage(model.model_name)
        
        if result["error"]:
            # Try fallback model
            for fallback_model in self.fallback.fallback_chain:
                if fallback_model != model.model_name:
                    fallback_result = await self.models[fallback_model].generate(prompt)
                    if not fallback_result["error"]:
                        return fallback_result["response"]
        
        return result["response"] 