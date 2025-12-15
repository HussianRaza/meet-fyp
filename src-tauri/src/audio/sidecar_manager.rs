use std::sync::{Arc, Mutex};
use std::process::{Child, Command};
use std::path::Path;

pub struct SidecarManager {
    pub process: Arc<Mutex<Option<Child>>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start_sidecar(&self) -> Result<(), String> {
        let mut python_bin = "python3".to_string();
        
        // Construct absolute path to venv without resolving symlinks
        if let Ok(cwd) = std::env::current_dir() {
            let venv_bin = cwd.parent().unwrap_or(&cwd).join(".venv/bin/python3");
            if venv_bin.exists() {
                python_bin = venv_bin.to_string_lossy().to_string();
            }
        }
        
        println!("Spawning sidecar using: {}", python_bin);
        
        let backend_dir = Path::new("../backend");
        let mut cmd = Command::new(python_bin);
        cmd.arg("main.py");
        if backend_dir.exists() {
             cmd.current_dir(backend_dir);
        }
        
        match cmd.spawn() {
            Ok(child) => {
                println!("Sidecar spawned successfully.");
                *self.process.lock().unwrap() = Some(child);
                Ok(())
            }
            Err(e) => Err(format!("Failed to spawn sidecar: {}", e)),
        }
    }

    pub fn stop_sidecar(&self) {
        let mut child_guard = self.process.lock().unwrap();
        if let Some(mut child) = child_guard.take() {
            println!("Killing sidecar...");
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
