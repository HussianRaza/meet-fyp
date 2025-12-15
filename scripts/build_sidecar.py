import os
import platform
import shutil
import subprocess
from pathlib import Path

def get_target_triple():
    machine = platform.machine().lower()
    system = platform.system().lower()
    
    if system == "darwin":
        if machine == "arm64":
            return "aarch64-apple-darwin"
        else:
            return "x86_64-apple-darwin"
    elif system == "windows":
        return "x86_64-pc-windows-msvc"
    elif system == "linux":
        return "x86_64-unknown-linux-gnu"
    else:
        raise Exception(f"Unsupported platform: {system} {machine}")

def build_sidecar():
    target_triple = get_target_triple()
    backend_dir = Path("backend")
    main_py = backend_dir / "main.py"
    
    if not main_py.exists():
        print(f"Error: {main_py} not found.")
        return

    print(f"Building for target: {target_triple}")
    
    # Run PyInstaller
    subprocess.run([
        "pyinstaller",
        "--clean",
        "--onefile",
        "--name", "api-server",
        str(main_py)
    ], check=True)
    
    # Expected output file
    dist_dir = Path("dist")
    
    if platform.system() == "Windows":
        binary_name = "api-server.exe"
        target_name = f"api-server-{target_triple}.exe"
    else:
        binary_name = "api-server"
        target_name = f"api-server-{target_triple}"
        
    source_bin = dist_dir / binary_name
    
    if not source_bin.exists():
        print(f"Error: Build artifact {source_bin} not found.")
        return
        
    # Move to src-tauri/binaries
    tauri_bin_dir = Path("src-tauri/binaries")
    tauri_bin_dir.mkdir(parents=True, exist_ok=True)
    
    dest_bin = tauri_bin_dir / target_name
    
    shutil.move(str(source_bin), str(dest_bin))
    print(f"Successfully moved binary to {dest_bin}")
    
    # Cleanup
    shutil.rmtree("build", ignore_errors=True)
    shutil.rmtree("dist", ignore_errors=True)
    if os.path.exists("api-server.spec"):
        os.remove("api-server.spec")

if __name__ == "__main__":
    build_sidecar()
