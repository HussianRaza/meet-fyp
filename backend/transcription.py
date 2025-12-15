import asyncio
import os
import logging
import numpy as np

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

class TranscriptionService:
    def __init__(self, model_size="base.en", audio_file="../testfiles/test_audio.mp3", chunk_duration=2.0):
        self.model_size = model_size
        self.audio_file = audio_file
        self.chunk_duration = chunk_duration
        self.model = None
        self.audio_data = None
        self.sample_rate = 16000

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
        Simulates streaming by processing the audio file in chunks.
        broadcast_callback: A coroutine function to send data to frontend.
        """
        if self.model is None or self.audio_data is None:
            self.load_resources()

        chunk_samples = int(self.chunk_duration * self.sample_rate)
        total_samples = len(self.audio_data)
        current_sample = 0
        
        logger.info(f"Starting transcription simulation. Total Duration: {total_samples/self.sample_rate:.2f}s")
        
        while True:
            # Simulate "streaming" by taking a slice up to current point + chunk
            # But wait! faster-whisper works best on the accumulated buffer OR a VAD-segmented chunk.
            # To simulate "live" transcription where the text updates:
            # We can transcribe the *entire* buffer available so far, which stabilizes previous text,
            # OR we can transcribe just the new chunk (less context).
            # For "typing itself out", transcribing the growing buffer is accurate but gets slower.
            # Let's try transcribing the *new* segment only with previous context? 
            # Actually, `faster-whisper` doesn't support streaming state easily in Python without low-level tweaks.
            # Simple approach: Transcribe the sliding window of last 30s?
            # Or just transcribe the growing buffer?
            
            # Let's simple-slice: Transcribe the accumulated buffer so far. 
            # Limit to last 30s to keep it fast? No, let's try growing buffer first.
            
            start_window = max(0, current_sample - (16000 * 30)) # context window
            end_window = min(current_sample + chunk_samples, total_samples)
            
            # If we reached end, loop back
            if current_sample >= total_samples:
                logger.info("Looping audio...")
                current_sample = 0
                await asyncio.sleep(1.0) # Pause before restart
                continue

            # In a real stream, we'd have a growing buffer. 
            # Here we just reveal more of the file.
            segment = self.audio_data[0:end_window] 
            
            # Optimization: Only transcribe the last 30 seconds to maintain speed?
            # If we play a long file, transcribing 10 minutes every 2 seconds is too slow.
            # Let's just transcribe the NEW chunk for now? No, context is lost.
            # Compromise: Transcribe the last 30 seconds.
            effective_start = max(0, end_window - (16000 * 30))
            audio_segment = self.audio_data[effective_start:end_window]

            start_time = asyncio.get_event_loop().time()
            
            # Run blocking model inference in a thread
            # Enable VAD filter to ignore silence
            segments, info = await asyncio.to_thread(
                self.model.transcribe, 
                audio_segment, 
                beam_size=5,
                language="en",
                condition_on_previous_text=False,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )

            # Collect text
            text = " ".join([segment.text for segment in segments]).strip()
            
            process_time = asyncio.get_event_loop().time() - start_time
            logger.debug(f"Transcribed {len(audio_segment)/16000:.2f}s in {process_time:.2f}s: {text}")

            # Filter known hallucinations
            hallucinations = ["You", "you", "You.", ".", "EXT.", "Music"]
            if text in hallucinations or not text:
                logger.debug(f"Ignored hallucination/empty: '{text}'")
            else:
                payload = {
                    "type": "transcription",
                    "text": text,
                    "partial": True 
                }
                await broadcast_callback(payload)

            # Advance time
            current_sample += chunk_samples
            
            # Wait for real-time duration (minus processing time to be accurate-ish?)
            # Just verify simple sleep vs drift.
            wait_time = max(0, self.chunk_duration - process_time) # try to keep up
            # If processing took longer than audio duration, don't sleep (live lag)
            await asyncio.sleep(wait_time if wait_time > 0 else 0.1)

