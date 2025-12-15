use anyhow::{anyhow, Result};
use byteorder::{ByteOrder, LittleEndian};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

// Define the Writer type for thread safety
pub type SharedWriter = Arc<Mutex<Box<dyn Write + Send>>>;

pub struct AudioPipeline {
    // We keep the stream alive by holding it in the struct
    #[allow(dead_code)]
    stream: cpal::Stream,
}

// SAFETY: access to the stream is guarded by Mutex in AppState,
// and we don't access the stream handle from multiple threads concurrently
// (cpal stream runs on its own thread).
// This is required because cpal::Stream is !Send on macOS.
unsafe impl Send for AudioPipeline {}
unsafe impl Sync for AudioPipeline {}

impl AudioPipeline {
    pub fn new(app: AppHandle, writer: SharedWriter) -> Result<Self> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| anyhow!("No input device"))?;

        println!("Using Input: {}", device.name().unwrap_or_default());

        let config = cpal::StreamConfig {
            channels: 1,
            sample_rate: cpal::SampleRate(16000), // Standard for Whisper
            buffer_size: cpal::BufferSize::Default,
        };

        let writer_clone = writer.clone();
        let app_clone = app.clone();

        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &_| {
                // 1. Ducking Logic (RMS Calculation)
                if !data.is_empty() {
                    let sum_squares: f32 = data.iter().map(|&x| x * x).sum();
                    let rms = (sum_squares / data.len() as f32).sqrt();
                    if rms > 0.1 {
                        let _ = app_clone.emit("duck_system_audio", rms);
                    }
                }

                // 2. Pipe Logic (Send bytes to Python)
                if let Ok(mut w) = writer_clone.lock() {
                    let mut bytes = vec![0u8; data.len() * 4];
                    LittleEndian::write_f32_into(data, &mut bytes);
                    if let Err(e) = w.write_all(&bytes) {
                        eprintln!("Pipe error: {}", e);
                    }
                    let _ = w.flush();
                }
            },
            move |err| eprintln!("Stream error: {}", err),
            None,
        )?;

        stream.play()?;
        Ok(Self { stream })
    }
}
