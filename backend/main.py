import sys
import threading
import numpy as np
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List
import uvicorn

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting: {e}")

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
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
    chunk_size = 4096 # Bytes
    
    while True:
        try:
            # distinct read for exactly chunk_size bytes isn't guaranteed by sys.stdin.buffer.read 
            # but for a continuous stream it's usually fine. 
            # Better to use read(chunk_size) which blocks until EOF or some bytes available.
            data = sys.stdin.buffer.read(chunk_size)
            if not data:
                break
            
            # Convert bytes to float32
            # Rust side sends: LittleEndian::write_f32_into(data, &mut bytes);
            audio_chunk = np.frombuffer(data, dtype=np.float32)
            
            if audio_chunk.size > 0:
                # Calculate RMS
                rms = np.sqrt(np.mean(audio_chunk**2))
                
                # Broadcast RMS
                # We need to run the async broadcast from this thread.
                # Since uvicorn runs in the main thread (or its own event loop), 
                # we need a way to schedule execution on the main event loop or use a separate loop.
                # HOWEVER, for simplicity in this sidecar pattern:
                # We can just print to stdout (log) or try to use the manager. 
                # But manager.broadcast is an async function.
                
                # Correction: uvicorn.run blocks. The background thread needs to communicate with the asyncio loop.
                # We can use asyncio.run_coroutine_threadsafe if we have access to the loop.
                
                # Let's get the running loop if possible, or just print for now as 'broadcast' placeholder
                # Real implementation:
                try:
                    # This requires the loop to be running.
                    # We can store the loop in a global var when app starts.
                    if 'loop' in globals() and globals()['loop']:
                         asyncio.run_coroutine_threadsafe(
                            manager.broadcast({"type": "audio_rms", "value": float(rms)}),
                            globals()['loop']
                        )
                except Exception as e:
                    print(f"Broadcast error: {e}", file=sys.stderr)

        except Exception as e:
            print(f"Error in audio loop: {e}", file=sys.stderr)

# We need to capture the event loop to schedule tasks from the thread
@app.on_event("startup")
async def startup_event():
    globals()['loop'] = asyncio.get_running_loop()
    # Start the audio thread
    t = threading.Thread(target=audio_loop, daemon=True)
    t.start()

if __name__ == "__main__":
    # Use a specific port, Tauri will expect this api-server to be running.
    # Note: When run as a sidecar, stdin is piped.
    uvicorn.run(app, host="127.0.0.1", port=1234)
