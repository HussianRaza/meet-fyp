import sys
import threading
import numpy as np
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List
import uvicorn
import logging
import os

# Setup logging
log_file = os.path.expanduser("~/.meetingai_sidecar.log")
logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# app = FastAPI() - Moved to bottom with lifespan

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FastAPI Startup")
    globals()['loop'] = asyncio.get_running_loop()
    
    # Check for Simulation Mode
    # For now, default to True as per user task "Simulate the audio stream"
    SIMULATION_MODE = True 
    
    # Meeting State
    app.state.meeting_active = True

    if SIMULATION_MODE:
        logger.info("Starting in SIMULATION MODE (Reading test_audio.mp3)")
        from transcription import TranscriptionService
        
        # Pass a lambda to check meeting state
        service = TranscriptionService(
            is_active_callback=lambda: getattr(app.state, "meeting_active", False)
        )
        
        # Define callback wrapper
        async def broadcast_wrapper(data):
            # Optimization: Don't broadcast if no one is listening OR meeting is inactive
            if not manager.active_connections or not getattr(app.state, "meeting_active", False):
                return False
            await manager.broadcast(data)
            return True
            
        # Start the async simulation task
        asyncio.create_task(service.run(broadcast_wrapper))
        
    else:
        logger.info("Starting in LIVE MODE (Reading stdin)")
        # Start the audio thread for stdin reading
        t = threading.Thread(target=audio_loop, daemon=True)
        t.start()
        
    yield
    # Cleanup if needed

app = FastAPI(lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        to_remove = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                # If sending fails, assume connection is dead
                # logger.debug(f"Broadcasting failed for client: {e}")
                to_remove.append(connection)
        
        for conn in to_remove:
            if conn in self.active_connections:
                self.active_connections.remove(conn)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # New connection implies interest in meeting, ensure it's active
    if hasattr(app.state, "meeting_active") and not app.state.meeting_active:
         logger.info("Client connected. Resuming meeting simulation.")
         app.state.meeting_active = True
         
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

def audio_loop():
    """
    Continuously reads raw audio from stdin, calculates RMS, and broadcasts it.
    Assumes 32-bit float audio from Rust.
    """
    print("Starting audio loop...", file=sys.stderr)
    logger.info("Starting audio loop")
    chunk_size = 4096 # Bytes
    
    while True:
        try:
            # distinct read for exactly chunk_size bytes isn't guaranteed by sys.stdin.buffer.read 
            # but for a continuous stream it's usually fine. 
            # Better to use read(chunk_size) which blocks until EOF or some bytes available.
            data = sys.stdin.buffer.read(chunk_size)
            if not data:
                logger.warning("Stdin closed")
                break
            
            # Convert bytes to float32
            # Rust side sends: LittleEndian::write_f32_into(data, &mut bytes);
            audio_chunk = np.frombuffer(data, dtype=np.float32)
            
            if audio_chunk.size > 0:
                # Calculate RMS
                rms = np.sqrt(np.mean(audio_chunk**2))
                # logger.debug(f"RMS: {rms}") # Too noisy

                # Broadcast RMS
                try:
                    # This requires the loop to be running.
                    # We can store the loop in a global var when app starts.
                    if 'loop' in globals() and globals()['loop'] and manager:
                         asyncio.run_coroutine_threadsafe(
                            manager.broadcast({"type": "audio_rms", "value": float(rms)}),
                            globals()['loop']
                        )
                except Exception as e:
                    logger.error(f"Broadcast error: {e}")
                    print(f"Broadcast error: {e}", file=sys.stderr)

        except Exception as e:
            logger.error(f"Error in audio loop: {e}")
            print(f"Error in audio loop: {e}", file=sys.stderr)

# Summarization Endpoint
from pydantic import BaseModel

class TranscriptRequest(BaseModel):
    transcript: str

@app.post("/generate-minutes")
async def generate_minutes(request: TranscriptRequest):
    logger.info(f"Received request to generate minutes. Transcript length: {len(request.transcript)}")
    
    # Stop the meeting simulation
    if hasattr(app.state, "meeting_active"):
        logger.info("Ending meeting simulation.")
        app.state.meeting_active = False

    # Lazy load the summarizer to avoid startup delay if not used
    if not hasattr(app.state, "summarizer"):
        from summarization import MeetingSummarizer
        app.state.summarizer = MeetingSummarizer()
        # Loading might take time, maybe offload to thread?
        # For now, let it block strictly for simplicity or use asyncio.to_thread
    
    try:
        # Run in thread to not block the event loop (heavy CPU task)
        summary = await asyncio.to_thread(app.state.summarizer.generate_minutes, request.transcript)
        return {"minutes": summary}
    except Exception as e:
        logger.error(f"Error generating minutes: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    # Use a specific port, Tauri will expect this api-server to be running.
    # Note: When run as a sidecar, stdin is piped.
    uvicorn.run(app, host="127.0.0.1", port=1234)
