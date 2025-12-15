import sys
import threading
import asyncio
import numpy as np
from typing import Callable
from config import settings, logger
from services.websocket_manager import manager

class AudioService:
    def __init__(self):
        self.loop = None
        
    def set_event_loop(self, loop):
        self.loop = loop

    async def broadcast_rms(self, rms: float):
        if self.loop and manager.active_connections:
            try:
                await manager.broadcast({"type": "audio_rms", "value": float(rms)})
            except Exception as e:
                logger.error(f"Broadcast error: {e}")

    def audio_loop(self):
        """
        Continuously reads raw audio from stdin, calculates RMS, and broadcasts it.
        Assumes 32-bit float audio from Rust.
        """
        logger.info("Starting audio loop (stdin)")
        chunk_size = 4096 # Bytes
        
        while True:
            try:
                data = sys.stdin.buffer.read(chunk_size)
                if not data:
                    logger.warning("Stdin closed")
                    break
                
                audio_chunk = np.frombuffer(data, dtype=np.float32)
                
                if audio_chunk.size > 0:
                    rms = np.sqrt(np.mean(audio_chunk**2))
                    
                    if self.loop:
                         asyncio.run_coroutine_threadsafe(
                            self.broadcast_rms(rms),
                            self.loop
                        )

            except Exception as e:
                logger.error(f"Error in audio loop: {e}")
                break

    async def start_simulation(self, check_active_callback: Callable[[], bool]):
        logger.info(f"Starting in SIMULATION MODE (Reading {settings.TEST_AUDIO_FILE})")
        from transcription import TranscriptionService
        
        service = TranscriptionService(
            is_active_callback=check_active_callback
        )
        
        async def broadcast_wrapper(data):
            if not manager.active_connections or not check_active_callback():
                return False
            await manager.broadcast(data)
            return True
            
        # Start the async simulation task
        asyncio.create_task(service.run(broadcast_wrapper))

audio_service = AudioService()
