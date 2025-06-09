import logging
import sys
from app.core.config import get_settings

def setup_logging():
    """
    Configure logging with console handler.
    Returns:
        logging.Logger: Configured logger instance.
    """
    settings = get_settings()
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.DEBUG)
    logger = logging.getLogger("app.core.logging")
    logger.setLevel(log_level)
    
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    logger.info("Logging setup initialized with console handler")
    return logger