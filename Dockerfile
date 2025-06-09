# Use NVIDIA CUDA base image for GPU support
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    TZ=UTC

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    python3.10-venv \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt -v

# Copy application code
COPY app/ app/

# Create necessary directories
RUN mkdir -p .chroma logs/compliance

# Expose ports
EXPOSE 8000 9090

# Set environment variables
ENV API_HOST=0.0.0.0 \
    API_PORT=8000 \
    DEBUG=false \
    OLLAMA_HOST=http://ollama:11434 \
    DEFAULT_MODEL=llama2-7b \
    MODEL_CACHE_SIZE=10GB \
    WHISPER_MODEL=small \
    CHROMA_PERSIST_DIR=.chroma \
    COMPLIANCE_MODE=gdpr_ccpa_hipaa \
    PII_DETECTION_LEVEL=strict \
    AUDIT_LOG_PATH=logs/compliance

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 