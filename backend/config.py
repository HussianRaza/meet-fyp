import os
import logging
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App Settings
    HOST: str = "127.0.0.1"
    PORT: int = 1234
    
    # Simulation
    SIMULATION_MODE: bool = True
    TEST_AUDIO_FILE: str = "testfiles/test_audio.mp3"
    
    # Logging
    LOG_FILE: str = os.path.expanduser("~/.meetingai_sidecar.log")
    LOG_LEVEL: int = logging.DEBUG
    
    class Config:
        env_file = ".env"

settings = Settings()

# Setup Logging
logging.basicConfig(
    filename=settings.LOG_FILE,
    level=settings.LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("meetingai_backend")
