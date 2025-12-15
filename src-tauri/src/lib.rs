use crate::audio::{AudioPipeline, SharedWriter};
use std::sync::{Arc, Mutex};
use tauri_plugin_shell::ShellExt;

mod audio;

pub struct AppState {
    pub audio: Mutex<Option<AudioPipeline>>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn start_audio_pipeline(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // 1. Spawn Sidecar or Python Script
    #[cfg(debug_assertions)]
    let sidecar_command = app.shell().command("python").args(&["../backend/main.py"]);

    #[cfg(not(debug_assertions))]
    let sidecar_command = app
        .shell()
        .sidecar("api-server")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?;

    let (_rx, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // 2. Extract Stdin
    // Tauri v2 shell spawn gives a child handle. We can write to it if we kept stdin open?
    // Wait, `tauri-plugin-shell` Architecture:
    // `spawn()` returns `(Receiver<CommandEvent>, Child)`.
    // `Child` has `write()` method to write to stdin.
    // BUT `write()` takes `&[u8]`. It doesn't give a raw `std::io::Write` trait object easily without wrapping.
    // `Child` in tauri-plugin-shell corresponds to the running process.
    // Writing to stdin is done via `child.write(buf)`.
    // However, `AudioPipeline` expects `SharedWriter` which is `Arc<Mutex<Box<dyn Write + Send>>>`.
    // We need to wrap `child` in something that implements `Write`.
    // The `Child` struct from `tauri_plugin_shell` implements `Write`? No, it has a `write` method.
    // Let's implement a wrapper struct for `Child` that implements `Write`.

    // Actually, `tauri_plugin_shell::process::Child` doesn't implement `std::io::Write`.
    // It has `pub fn write(&mut self, buf: &[u8]) -> Result<(), Error>`.

    // So we need a wrapper.
    // Assuming Child is at the top level or process module is private but Child is re-exported?
    // Let's try matching the type returned by spawn() without naming it if possible?
    // No, we need to name it for the struct.
    // Try importing from root.
    // Wait, typical name might be CommandChild or just Child.
    // If 'Child' was not found in 'process', maybe 'CommandChild'?
    // Let's try a different approach: Inspect the type using a trait object if possible? No.
    // I will try 'tauri_plugin_shell::process::Terminatable' ? No.

    // Let's assume the previous error was correct about `process::Child` missing.
    // I'll try `tauri_plugin_shell::Child`.
    // Actually, looking at docs, it might be `tauri_plugin_shell::process::Command` -> `spawn` -> `(..., Child)`.
    // If I cannot name it, I can't preserve it easily in a struct field.

    // Workaround: define the struct generic, but impl Write for specific type? No.

    // Real Fix: The type is `tauri_plugin_shell::process::Child` in v1, but in v2??
    // In v2 it is `tauri_plugin_shell::process::Child`.
    // Maybe I am using `Default` features and it is behind a feature?
    // shell plugin is enabled.

    use tauri_plugin_shell::process::CommandChild;

    struct ChildWriter(CommandChild);
    impl std::io::Write for ChildWriter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0.write(buf).map_err(|e: tauri_plugin_shell::Error| {
                std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
            })?;
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    let writer = ChildWriter(child);
    let shared_writer: SharedWriter = Arc::new(Mutex::new(Box::new(writer)));

    // 3. Start Audio Pipeline
    let pipeline = AudioPipeline::new(app, shared_writer).map_err(|e| e.to_string())?;

    *state.audio.lock().unwrap() = Some(pipeline);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            audio: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![greet, start_audio_pipeline])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
