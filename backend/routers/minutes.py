from fastapi import APIRouter, Request
from pydantic import BaseModel
import asyncio
from config import logger

router = APIRouter()

class TranscriptRequest(BaseModel):
    transcript: str

@router.post("/generate-minutes")
async def generate_minutes(request: TranscriptRequest, fastapi_request: Request):
    logger.info(f"Received request to generate minutes. Transcript length: {len(request.transcript)}")
    
    app_state = fastapi_request.app.state

    # Stop the meeting simulation
    if hasattr(app_state, "meeting_active"):
        logger.info("Ending meeting simulation.")
        app_state.meeting_active = False

    # Lazy load the summarizer
    if not hasattr(app_state, "summarizer"):
        from summarization import MeetingSummarizer
        app_state.summarizer = MeetingSummarizer()
    
    try:
        # Run in thread to not block the event loop
        summary = await asyncio.to_thread(app_state.summarizer.generate_minutes, request.transcript)
        return {"minutes": summary}
    except Exception as e:
        logger.error(f"Error generating minutes: {e}")
        return {"error": str(e)}
