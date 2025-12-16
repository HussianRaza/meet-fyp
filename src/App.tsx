import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar";
import MeetingHeader from "./components/MeetingHeader";
import SummaryPanel from "./components/SummaryPanel";
import TranscriptRail from "./components/TranscriptRail";
import AIWidget from "./components/AIWidget";
import "./App.css";

// Interface from TranscriptionDisplay
interface TranscriptionEvent {
  type: string;
  text: string;
  partial: boolean;
}

function App() {
  const [transcription, setTranscription] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Minutes state
  const [minutes, setMinutes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize Sidecar Pipeline
  useEffect(() => {
    const startPipeline = async () => {
      try {
        console.log("Initializing Audio Pipeline...");
        await invoke('start_audio_pipeline');
        console.log("Audio Pipeline Started.");
      } catch (e) {
        console.error("Failed to start audio pipeline:", e);
      }
    };

    startPipeline();

    return () => {
      console.log("Stopping Audio Pipeline...");
      invoke('stop_audio_pipeline').catch(console.error);
    };
  }, []);

  // WebSocket Logic (lifted from TranscriptionDisplay)
  useEffect(() => {
    const connect = () => {
      // Connect to the sidecar backend
      const ws = new WebSocket('ws://127.0.0.1:1234/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to Transcription WS');
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from Transcription WS');
        if (wsRef.current) { 
             setTimeout(connect, 3000); 
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as TranscriptionEvent;
          if (data.type === 'transcription') {
            setTranscription(data.text);
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      return ws;
    };

    const ws = connect();

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const generateMinutes = async () => {
    if (!transcription) return;
    
    // Stop transcription to signify "End Meeting"
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null; 
        setIsConnected(false);
    }

    setIsGenerating(true);
    setError(null);
    setMinutes(null);

    try {
      const response = await fetch('http://127.0.0.1:1234/generate-minutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: transcription }),
      });
      
      const data = await response.json();
      if (data.points || data.minutes) {
        setMinutes(data.minutes || data.points);
      } else if (data.error) {
         setError(`Server Error: ${data.error}`);
      } else {
        setError("Failed to generate minutes: Empty response");
      }
    } catch (e: any) {
      console.error("Error generating minutes:", e);
      setError(`Network Error: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-foreground overflow-hidden font-sans">
      {/* 1. Global Sidebar */}
      <Sidebar />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
        
        {/* Header */}
        <MeetingHeader 
            onGenerateMinutes={generateMinutes}
            isGenerating={isGenerating}
            hasTranscript={!!transcription}
        />

        {/* Content Body: Split View */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Center Panel: Intelligence & Summary */}
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Placeholder for future specific smart blocks */}
                    <SummaryPanel minutes={minutes} error={error} />
                </div>
            </main>

            {/* Right Rail: Transcript */}
            <aside className="hidden lg:block border-l border-gray-800 bg-gray-900">
                <TranscriptRail transcription={transcription} isConnected={isConnected} />
            </aside>

        </div>
      </div>

      {/* 3. Floating Widget */}
      {isConnected && <AIWidget />}
    </div>
  );
}

export default App;
