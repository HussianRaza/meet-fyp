use std::sync::Arc;
use tauri::{AppHandle, Manager};

mod audio_capture;
mod sidecar_manager;

use audio_capture::AudioCapture;
use sidecar_manager::SidecarManager;

pub struct AudioState {
    pub capture: Arc<AudioCapture>,
    pub sidecar: Arc<SidecarManager>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            capture: Arc::new(AudioCapture::new()),
            sidecar: Arc::new(SidecarManager::new()),
        }
    }
}

pub fn init_audio_state() -> AudioState {
    AudioState::new()
}

#[tauri::command]
pub async fn start_audio_pipeline(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    // Start Payload Sidecar
    state.sidecar.start_sidecar()?;
    
    // Start Audio Capture
    state.capture.start_capture(app.clone())?;
    
    Ok(())
}

#[tauri::command]
pub async fn stop_audio_pipeline(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AudioState>();
    
    state.capture.stop_capture();
    state.sidecar.stop_sidecar();
    
    Ok(())
}
