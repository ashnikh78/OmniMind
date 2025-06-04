import logging

logger = logging.getLogger(__name__)

class WebSocketService:
    def __init__(self):
        self.connected = False

    def connect(self):
        logger.info("WebSocket service connected")
        self.connected = True

    def disconnect(self):
        logger.info("WebSocket service disconnected")
        self.connected = False

websocket_service = WebSocketService()