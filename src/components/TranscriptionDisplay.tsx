import { useEffect, useState, useRef } from 'react';

interface TranscriptionEvent {
  type: string;
  text: string;
  partial: boolean;
}

export default function TranscriptionDisplay() {
  const [transcription, setTranscription] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const transcriptionEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    transcriptionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcription]);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://127.0.0.1:1234/ws');

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to Transcription WS');
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from Transcription WS');
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as TranscriptionEvent;
          if (data.type === 'transcription') {
            // For now, we just replace/update. 
            // Often "partial" means current sentence is evolving.
            // If we receive the full text buffer each time (as per my backend logic), we just replace.
            // If backend sends only new chunks, we append.
            // My backend logic currently sends "last 30s transcribed". 
            // This UI might flicker if I just replace. 
            // Let's assume for this "Simulation" where I send the whole text of the last 30s:
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
    };
  }, []);

  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-700 mt-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-100">Live Transcription</h2>
        <span className={`px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      
      <div className="h-48 overflow-y-auto bg-gray-800 p-3 rounded text-gray-300 font-mono text-sm">
        {transcription ? transcription : <span className="text-gray-500 italic">Waiting for speech...</span>}
        <div ref={transcriptionEndRef} />
      </div>
    </div>
  );
}
