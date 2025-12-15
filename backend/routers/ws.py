from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from services.websocket_manager import manager
from config import logger

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Access app state via websocket.app.state
    # New connection implies interest in meeting, ensure it's active
    if hasattr(websocket.app.state, "meeting_active") and not websocket.app.state.meeting_active:
         logger.info("Client connected. Resuming meeting simulation.")
         websocket.app.state.meeting_active = True
         
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
