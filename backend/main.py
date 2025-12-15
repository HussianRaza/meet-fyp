import asyncio
import threading
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings, logger
from services.audio_service import audio_service
from routers import ws, minutes

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FastAPI Startup")
    loop = asyncio.get_running_loop()
    audio_service.set_event_loop(loop)
    
    # Meeting State
    app.state.meeting_active = True

    if settings.SIMULATION_MODE:
        # Check meeting state callback
        check_active = lambda: getattr(app.state, "meeting_active", False)
        await audio_service.start_simulation(check_active)
    else:
        logger.info("Starting in LIVE MODE (Reading stdin)")
        t = threading.Thread(target=audio_service.audio_loop, daemon=True)
        t.start()
        
    yield
    # Cleanup

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws.router)
app.include_router(minutes.router)

if __name__ == "__main__":
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
