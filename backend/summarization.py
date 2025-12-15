import logging
import os
from huggingface_hub import hf_hub_download
from llama_cpp import Llama

logger = logging.getLogger(__name__)

class MeetingSummarizer:
    def __init__(self, model_repo="Qwen/Qwen2.5-0.5B-Instruct-GGUF", model_file="qwen2.5-0.5b-instruct-q4_k_m.gguf"):
        self.model_repo = model_repo
        self.model_file = model_file
        self.llm = None
        self.model_path = None

    def load_model(self):
        """Downloads (if needed) and loads the quantized LLM."""
        if self.llm is not None:
            return

        logger.info(f"Loading summarization model: {self.model_repo} / {self.model_file}")
        try:
            # Download model if not cached
            self.model_path = hf_hub_download(repo_id=self.model_repo, filename=self.model_file)
            logger.info(f"Model path: {self.model_path}")

            # Initialize Llama
            # context_window 2048 is default, might need more for long meetings.
            # Qwen uses 32k context theoretically but we limit to keep it light.
            self.llm = Llama(
                model_path=self.model_path, 
                n_ctx=4096, # Increased slightly for Qwen
                n_gpu_layers=0, # Force CPU
                verbose=False 
            )
            logger.info("Summarization model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load summarization model: {e}")
            raise

    def generate_minutes(self, transcript: str) -> str:
        """Generates structured meeting minutes from the transcript."""
        if not transcript or not transcript.strip():
            return "No transcript available to summarize."

        if self.llm is None:
            self.load_model()

        # Prompt engineering for Qwen2.5 (ChatML format)
        prompt = f"""<|im_start|>system
You are a helpful assistant that summarizes meeting transcripts.
Generate structured Meeting Minutes with:
1. Summary
2. Key Decisions
3. Action Items<|im_end|>
<|im_start|>user
Here is the meeting transcript:
{transcript}

Generate the Meeting Minutes.<|im_end|>
<|im_start|>assistant
"""

        logger.info("Generating summary...")
        output = self.llm(
            prompt, 
            max_tokens=1024, # Increased for potentially longer output
            stop=["<|im_end|>"], 
            echo=False,
            temperature=0.7
        )
        
        if len(output["choices"]) > 0:
            result = output["choices"][0]["text"].strip()
            logger.info(f"Summary generated (Length: {len(result)} chars)")
            logger.debug(f"Raw Output: {result}")
            return result
        else:
             logger.error("LLM returned no choices.")
             return "Error: No summary generated."
