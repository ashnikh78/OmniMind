class Settings(BaseSettings):
    # ... existing settings ...
    
    # Ollama settings
    OLLAMA_HOST: str = "http://localhost:11434"
    MODEL_UNLOAD_TIMEOUT: int = 300  # 5 minutes
    
    class Config:
        env_file = ".env" 