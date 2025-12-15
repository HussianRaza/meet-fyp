use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;
use tauri::{AppHandle, Emitter};

pub struct AudioCapture {
    pub stop_sender: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    pub is_recording: Arc<Mutex<bool>>,
}

impl AudioCapture {
    pub fn new() -> Self {
        Self {
            stop_sender: Arc::new(Mutex::new(None)),
            is_recording: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start_capture(&self, app_handle: AppHandle) -> Result<(), String> {
        if *self.is_recording.lock().unwrap() {
            return Ok(());
        }

        let host = cpal::default_host();
        let device = host.default_input_device()
            .ok_or("No input device found")?;
        
        let config = device.default_input_config()
            .map_err(|e| e.to_string())?;

        let (tx, rx) = oneshot::channel::<()>();
        
        // Spawn capture thread
        std::thread::spawn(move || {
            let err_fn = |err| eprintln!("an error occurred on stream: {}", err);
            
            let stream_result = device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &_| {
                    // RMS Calculation
                    let rms: f32 = if !data.is_empty() {
                        (data.iter().map(|v| v * v).sum::<f32>() / data.len() as f32).sqrt()
                    } else {
                        0.0
                    };
                    let _ = app_handle.emit("audio-level", rms);
                },
                err_fn,
                None 
            );

            match stream_result {
                Ok(stream) => {
                    if let Err(e) = stream.play() {
                        eprintln!("Failed to play stream: {}", e);
                        return;
                    }
                    
                    // Wait for stop signal
                    let _ = rx.blocking_recv();
                    drop(stream);
                }
                Err(e) => eprintln!("Failed to build input stream: {}", e),
            }
        });

        *self.stop_sender.lock().unwrap() = Some(tx);
        *self.is_recording.lock().unwrap() = true;
        
        Ok(())
    }

    pub fn stop_capture(&self) {
         if let Some(tx) = self.stop_sender.lock().unwrap().take() {
            let _ = tx.send(());
        }
        *self.is_recording.lock().unwrap() = false;
    }
}
