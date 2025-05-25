import asyncio
import time
import torch
import logging
from typing import Dict, Any, Optional
import ollama
from app.core.config import settings

logger = logging.getLogger(__name__)

class OllamaModel:
    def __init__(self, model_name: str):
        self.model_name = model_name
        self._loaded = False
        self._last_used = 0
        self._concurrent_requests = 0
        self._gpu_enabled = torch.cuda.is_available()
        self._client = ollama.Client(host=settings.OLLAMA_HOST)
        self._lock = asyncio.Lock()
        
    async def warm_up(self):
        """Warm up the model by loading it into memory."""
        async with self._lock:
            if not self._loaded:
                try:
                    # Check if model exists
                    models = await self._client.list()
                    if not any(m["name"] == self.model_name for m in models.get("models", [])):
                        # Pull model if not exists
                        await self._client.pull(self.model_name)
                    
                    # Load model
                    await self._client.load(self.model_name)
                    self._loaded = True
                    self._last_used = time.time()
                    logger.info(f"Model {self.model_name} loaded successfully")
                except Exception as e:
                    logger.error(f"Error loading model {self.model_name}: {str(e)}")
                    raise
    
    async def unload(self):
        """Unload the model from memory."""
        async with self._lock:
            if self._loaded:
                try:
                    await self._client.unload(self.model_name)
                    self._loaded = False
                    logger.info(f"Model {self.model_name} unloaded successfully")
                except Exception as e:
                    logger.error(f"Error unloading model {self.model_name}: {str(e)}")
                    raise
    
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        top_p: float = 0.9
    ) -> Dict[str, Any]:
        """Generate a response from the model."""
        start_time = time.time()
        
        async with self._lock:
            if not self._loaded:
                await self.warm_up()
            
            self._concurrent_requests += 1
            self._last_used = time.time()
            
            try:
                response = await self._client.generate(
                    model=self.model_name,
                    prompt=prompt,
                    options={
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        "top_p": top_p
                    }
                )
                
                latency = time.time() - start_time
                gpu_memory = torch.cuda.memory_allocated() if self._gpu_enabled else 0
                
                return {
                    "response": response.get("response", ""),
                    "latency": latency,
                    "gpu_memory": gpu_memory,
                    "error": False
                }
                
            except Exception as e:
                logger.error(f"Error generating response: {str(e)}")
                return {
                    "error": True,
                    "error_message": str(e)
                }
                
            finally:
                self._concurrent_requests -= 1
                
                # Auto-unload if not used for a while
                if self._concurrent_requests == 0 and time.time() - self._last_used > settings.MODEL_UNLOAD_TIMEOUT:
                    await self.unload() 