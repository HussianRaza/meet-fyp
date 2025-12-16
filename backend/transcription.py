import asyncio
import os
import logging
import numpy as np

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

class TranscriptionService:
    def __init__(self, model_size="tiny.en", audio_file="../testfiles/test_audio.mp3", chunk_duration=2.0, simulate_realtime=False, is_active_callback=None):
        self.model_size = model_size
        self.audio_file = audio_file
        self.chunk_duration = chunk_duration
        self.model = None
        self.audio_data = None
        self.sample_rate = 16000
        self.simulate_realtime = simulate_realtime
        self.is_active_callback = is_active_callback

    def load_resources(self):
        """Loads the Whisper model and the audio file."""
        logger.info(f"Loading Whisper model: {self.model_size}")
        try:
             self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise

        logger.info(f"Loading audio file: {self.audio_file}")
        if not os.path.exists(self.audio_file):
            logger.error(f"Audio file not found: {self.audio_file}")
            self.audio_data = np.zeros(16000 * 10, dtype=np.float32) 
        else:
            try:
                # Use av to load audio and resample to 16kHz mono
                import av
                container = av.open(self.audio_file)
                stream = container.streams.audio[0]
                
                resampler = av.AudioResampler(format='flt', layout='mono', rate=self.sample_rate)
                
                audio_data = []
                for frame in container.decode(stream):
                    frame.pts = None # avoid warning
                    resampled_frames = resampler.resample(frame)
                    for rf in resampled_frames:
                        audio_data.append(rf.to_ndarray().flatten())
                
                self.audio_data = np.concatenate(audio_data)
                
            except Exception as e:
                logger.error(f"Failed to load audio file with av: {e}")
                import traceback
                logger.error(traceback.format_exc())
                self.audio_data = np.zeros(16000 * 10, dtype=np.float32)

        logger.info("Resources loaded successfully.")

    async def run(self, broadcast_callback):
        """
        Runs the transcription simulation.
        broadcast_callback: A coroutine function to send data to frontend.
        """
        if self.model is None or self.audio_data is None:
            self.load_resources()

        if self.simulate_realtime:
            logger.info("Starting REAL-TIME transcription simulation.")
            await self._run_realtime(broadcast_callback)
        else:
            logger.info("Starting FAST FORWARD transcription simulation.")
            await self._run_fast_forward(broadcast_callback)

    async def _run_fast_forward(self, broadcast_callback):
        """Fast Forwards the meeting by transcribing the entire file as fast as possible."""
        # Transcribe the entire audio data at once
        segments, info = await asyncio.to_thread(
            self.model.transcribe, 
            self.audio_data, 
            beam_size=5,
            language="en",
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        accumulated_text = ""
        
        for segment in segments:
            accumulated_text += segment.text + " "
            payload = {
                 "type": "transcription",
                 "text": accumulated_text.strip(),
                 "partial": True 
            }
            has_clients = await broadcast_callback(payload)
            if not has_clients:
                logger.info("No clients connected. Pausing simulation...")
                while not has_clients:
                     await asyncio.sleep(1.0)
                     # Try to send a dummy/ping or just check if we can resume?
                     # Actually, the callback wrapper checks manager.active_connections.
                     # But we need to invoke it to check.
                     # Let's send a dummy partial update to check?
                     # Or better, just wait 1s and retry the SAME payload.
                     has_clients = await broadcast_callback(payload)
                logger.info("Clients connected. Resuming simulation.")

            await asyncio.sleep(0)

        logger.info("Fast Forward transcription complete.")
        while True:
             await asyncio.sleep(1.0)

    async def _run_realtime(self, broadcast_callback):
        """
        Simulates streaming by pre-transcribing the file and emitting segments 
        at their corresponding timestamps. This ensures full history is preserved
        without the complexity of sliding window deduplication.
        """
        logger.info("Transcribing full audio for real-time simulation...")
        
        # Transcribe the entire file first (like fast-forward)
        segments_generator, info = await asyncio.to_thread(
            self.model.transcribe, 
            self.audio_data, 
            beam_size=5,
            language="en",
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        # Consume generator to get all segments
        segments = list(segments_generator)
        logger.info(f"Pre-transcription complete. Found {len(segments)} segments. Starting playback...")

        accumulated_text = ""
        start_time = asyncio.get_event_loop().time()
        
        for i, segment in enumerate(segments):
            # Check if meeting is active (pause logic)
            if self.is_active_callback:
                 while not self.is_active_callback():
                     await asyncio.sleep(0.5)
                     # Reset start time so we don't jump ahead
                     # This is tricky without tracking paused duration.
                     # For simplicity in this demo, we just wait. 
                     # A better impl would adjust start_time.
                     start_time = asyncio.get_event_loop().time() - segment.start

            # Calculate when this segment should appear
            # segment.end is in seconds
            target_time = segment.end
            
            # Current playback time
            current_time = asyncio.get_event_loop().time() - start_time
            
            wait_time = target_time - current_time
            
            if wait_time > 0:
                logger.debug(f"Waiting {wait_time:.2f}s for segment {i}...")
                await asyncio.sleep(wait_time)

            # Update text
            accumulated_text += segment.text + " "
            
            logger.debug(f"Emitting segment {i}: {segment.text}")
            
            payload = {
                "type": "transcription",
                "text": accumulated_text.strip(),
                "partial": True 
            }
            await broadcast_callback(payload)

        logger.info("Real-time simulation complete.")
        while True:
             await asyncio.sleep(1.0)

