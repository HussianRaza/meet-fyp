import { useEffect, useState } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export default function AudioMonitor() {
  const [isActive, setIsActive] = useState(false);
  const [rms, setRms] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupAudio = async () => {
      try {
        console.log("Starting simple audio pipeline...");
        await invoke('start_audio_pipeline');
        setIsActive(true);
        
        // Listen for float RMS updates
        unlisten = await listen<number>('audio-level', (event) => {
          setRms(event.payload);
        });
        
        console.log("Audio pipeline started successfully");
      } catch (err: any) {
        console.error("Failed to start audio pipeline:", err);
        setError(String(err));
        setIsActive(false);
      }
    };

    setupAudio();

    // Cleanup on unmount
    return () => {
      if (unlisten) unlisten();
      invoke('stop_audio_pipeline').catch(console.error);
    };
  }, []);

  // Styles
  const containerStyle: React.CSSProperties = {
    padding: '1.5rem',
    borderRadius: '1rem',
    backgroundColor: '#1f2937',
    color: '#f3f4f6',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    margin: '20px auto',
    fontFamily: 'system-ui, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    backgroundColor: isActive ? '#065f46' : '#7f1d1d',
    color: isActive ? '#34d399' : '#f87171',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Audio Levels</h2>
        <span style={badgeStyle}>{isActive ? 'RECORDING' : 'IDLE'}</span>
      </div>
      
      {error && (
        <div style={{ color: '#f87171', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
             <span style={{ fontWeight: 500 }}>Microphone Input</span>
             <span style={{ color: '#9ca3af' }}>RMS: {rms.toFixed(3)}</span>
         </div>
         
         <div style={{ height: '12px', backgroundColor: '#374151', borderRadius: '6px', overflow: 'hidden' }}>
           <div 
             style={{
               height: '100%',
               width: `${Math.min(rms * 100 * 5, 100)}%`, // Amplify RMS x5 for visibility
               backgroundColor: '#3b82f6', 
               transition: 'width 50ms linear',
             }} 
           />
         </div>
      </div>
    </div>
  );
}
