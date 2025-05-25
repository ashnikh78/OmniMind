import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from datetime import datetime

from src.services.ml.models import (
    ModelConfig,
    InferenceRequest,
    InferenceResponse,
    TokenUsage,
    ModelMetrics,
    ModelRegistry
)
from src.services.ml.service import MLService


@pytest.fixture
def mock_client():
    """Create a mock HTTP client."""
    client = AsyncMock(spec=httpx.AsyncClient)
    return client


@pytest.fixture
def model_registry():
    """Create a test model registry."""
    return ModelRegistry(
        models={
            "test": ModelConfig(
                name="test-model",
                endpoint="http://test:8000/generate",
                max_tokens=100,
                temperature=0.5
            )
        }
    )


@pytest.fixture
def ml_service(mock_client, model_registry):
    """Create ML service instance with mocked client."""
    service = MLService(model_registry=model_registry, client=mock_client)
    return service


@pytest.mark.asyncio
async def test_inference_success(ml_service, mock_client):
    """Test successful model inference."""
    # Mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "response": "Test response",
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30,
        "finish_reason": "stop"
    }
    mock_client.post.return_value = mock_response
    
    # Create request
    request = InferenceRequest(
        prompt="Test prompt",
        model="test"
    )
    
    # Call inference
    response = await ml_service.inference(request)
    
    # Assertions
    assert isinstance(response, InferenceResponse)
    assert response.text == "Test response"
    assert response.model == "test"
    assert response.usage.prompt_tokens == 10
    assert response.usage.completion_tokens == 20
    assert response.usage.total_tokens == 30
    assert response.finish_reason == "stop"
    
    # Verify client call
    mock_client.post.assert_called_once()
    call_args = mock_client.post.call_args[1]
    assert call_args["json"]["model"] == "test-model"
    assert call_args["json"]["prompt"] == "Test prompt"


@pytest.mark.asyncio
async def test_inference_error(ml_service, mock_client):
    """Test model inference with error."""
    # Mock error response
    mock_client.post.side_effect = httpx.HTTPError("Test error")
    
    # Create request
    request = InferenceRequest(
        prompt="Test prompt",
        model="test"
    )
    
    # Call inference and expect error
    with pytest.raises(Exception):
        await ml_service.inference(request)


@pytest.mark.asyncio
async def test_list_models(ml_service, model_registry):
    """Test listing available models."""
    models = await ml_service.list_models()
    
    assert isinstance(models, dict)
    assert "test" in models
    assert isinstance(models["test"], ModelConfig)
    assert models["test"].name == "test-model"


@pytest.mark.asyncio
async def test_get_metrics(ml_service):
    """Test getting model metrics."""
    # First make an inference to generate metrics
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "response": "Test response",
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30,
        "finish_reason": "stop"
    }
    ml_service._client.post.return_value = mock_response
    
    request = InferenceRequest(
        prompt="Test prompt",
        model="test"
    )
    await ml_service.inference(request)
    
    # Get metrics
    metrics = await ml_service.get_metrics("test")
    
    assert isinstance(metrics, ModelMetrics)
    assert metrics.model_name == "test"
    assert metrics.requests == 1
    assert metrics.error_rate == 0.0
    assert metrics.avg_latency > 0


@pytest.mark.asyncio
async def test_get_metrics_not_found(ml_service):
    """Test getting metrics for non-existent model."""
    with pytest.raises(ValueError, match="No metrics available for model nonexistent"):
        await ml_service.get_metrics("nonexistent")


@pytest.mark.asyncio
async def test_client_management(ml_service):
    """Test client creation and cleanup."""
    # Get client
    client1 = await ml_service.client
    assert client1 is not None
    
    # Get client again (should be same instance)
    client2 = await ml_service.client
    assert client2 is client1
    
    # Close client
    await ml_service.close()
    assert ml_service._client is None 