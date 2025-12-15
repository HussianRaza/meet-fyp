use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Emitter};
use tokio::sync::oneshot;

pub struct AudioState {
    // specific Send+Sync types
    pub stop_sender: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    pub is_recording: Arc<Mutex<bool>>,
    pub python_child: Arc<Mutex<Option<std::process::Child>>>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            stop_sender: Arc::new(Mutex::new(None)),
            is_recording: Arc::new(Mutex::new(false)),
            python_child: Arc::new(Mutex::new(None)),
        }
    }
}

pub fn init_audio_state() -> AudioState {
    AudioState::new()
}

#[tauri::command]
pub async fn start_audio_pipeline(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    // Check if already recording
    if *state.is_recording.lock().unwrap() {
        return Ok(()); 
    }

    println!("Starting audio pipeline...");

    // --- Start Python Sidecar ---
    // Try to find the venv python
    let mut python_bin = "python3".to_string();
    
    // Construct absolute path to venv without resolving symlinks (filesytem::canonicalize resolves symlinks which breaks venv)
    if let Ok(cwd) = std::env::current_dir() {
        let venv_bin = cwd.parent().unwrap_or(&cwd).join(".venv/bin/python3");
        if venv_bin.exists() {
            python_bin = venv_bin.to_string_lossy().to_string();
        }
    }
    
    println!("Spawning sidecar using: {}", python_bin);
    
    // Determine backend directory
    let backend_dir = std::path::Path::new("../backend");
    let mut cmd = std::process::Command::new(python_bin);
    cmd.arg("main.py");
    if backend_dir.exists() {
         cmd.current_dir(backend_dir);
    }
    
    match cmd.spawn() {
        Ok(child) => {
            println!("Sidecar spawned successfully.");
            *state.python_child.lock().unwrap() = Some(child);
        }
        Err(e) => {
            eprintln!("Failed to spawn sidecar: {}", e);
            // We continue anyway? Or fail?
            // For now continue, but UI will be offline ofc.
        }
    }
    // ---------------------------

    // Get default device and config
    // Note: We do this inside the async task, but the stream creation will happen in a detached thread
    let host = cpal::default_host();
    let device = host.default_input_device()
        .ok_or("No input device found")?;
    
    println!("Using input device: {}", device.name().unwrap_or_default());
    
    let config = device.default_input_config()
        .map_err(|e| e.to_string())?;

    // Create channel to signal stop
    let (tx, rx) = oneshot::channel::<()>();
    
    let app_handle = app.clone();
    
    // Spawn a dedicated standard thread to host the stream (resolves !Send issues on macOS)
    std::thread::spawn(move || {
        let err_fn = |err| eprintln!("an error occurred on stream: {}", err);
        
        // Custom 16kHz mono config
        let target_config = cpal::StreamConfig {
            channels: 1,
            sample_rate: cpal::SampleRate(16000),
            buffer_size: cpal::BufferSize::Default,
        };
        
        // Note: Using default config to convert because build_input_stream expects SupportedStreamConfig
        // But we want specific config. cpal build_input_stream takes &StreamConfig.
        // Wait, device.build_input_stream(config, ...) -> config is StreamConfig.
        // The user code uses `&config.into()`. default_input_config returns SupportedStreamConfig.
        // .into() converts SupportedStreamConfig to StreamConfig?
        // Let's stick strictly to user code. User code: `&config.into()` with `let config = device.default_input_config()`.
        
        let stream_result = device.build_input_stream(
            &config.into(), // Using default for now to guarantee compatibility
            move |data: &[f32], _: &_| {
                // Calculation for visualization
                let rms: f32 = if !data.is_empty() {
                    (data.iter().map(|v| v * v).sum::<f32>() / data.len() as f32).sqrt()
                } else {
                    0.0
                };
                let _ = app_handle.emit("audio-level", rms);
                
                // Placeholder for Python pipe
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
                println!("Audio stream playing on dedicated thread...");
                
                // Block this thread until we receive the stop signal
                // mixing async channel with sync blocking recv
                let _ = rx.blocking_recv();
                
                println!("Stop signal received, dropping stream...");
                drop(stream);
            }
            Err(e) => {
                 eprintln!("Failed to build input stream: {}", e);
            }
        }
    });

    // Update state
    *state.stop_sender.lock().unwrap() = Some(tx);
    *state.is_recording.lock().unwrap() = true;

    println!("Audio pipeline started!");
    Ok(())
}

#[tauri::command]
pub async fn stop_audio_pipeline(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    // Take the sender out of the Option, if it exists
    if let Some(tx) = state.stop_sender.lock().unwrap().take() {
        // Sending the signal unblocks the thread, causing it to finish and drop the stream
        let _ = tx.send(());
    }
    
    // Kill Sidecar
    let mut child_guard = state.python_child.lock().unwrap();
    if let Some(mut child) = child_guard.take() {
        println!("Killing sidecar...");
        let _ = child.kill();
        let _ = child.wait(); // ensure it's gone
    }
    
    *state.is_recording.lock().unwrap() = false;
    println!("Audio pipeline stopped.");
    Ok(())
}
