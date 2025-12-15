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

  // Minutes Generation State
  const [minutes, setMinutes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://127.0.0.1:1234/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to Transcription WS');
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from Transcription WS');
        // Only reconnect if we didn't manually close (we'll rely on isConnected or another flag if needed, 
        // but for now simple timeout is ok unless we want to permanently stop).
        // basic reconnect logic:
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
    
    // Stop transcription
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null; // Prevent reconnect
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
      if (data.points || data.minutes) { // Handle potential different keys
        setMinutes(data.minutes || data.points); // Fallback if backend changed
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
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-700 mt-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-100">Live Transcription</h2>
        <div className="flex items-center gap-2">
           <span className={`px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
             {isConnected ? 'LIVE' : 'OFFLINE'}
           </span>
        </div>
      </div>
      
      <div className="h-48 overflow-y-auto bg-gray-800 p-3 rounded text-gray-300 font-mono text-sm mb-4">
        {transcription ? transcription : <span className="text-gray-500 italic">Waiting for speech...</span>}
        <div ref={transcriptionEndRef} />
      </div>

       {/* Actions */}
       <div className="flex justify-end mb-4">
        <button
          onClick={generateMinutes}
          disabled={isGenerating || !transcription}
          className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
            isGenerating || !transcription 
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {isGenerating ? 'Generating Summary...' : 'End Meeting & Generate Minutes'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-100 rounded text-sm">
          {error}
        </div>
      )}

      {/* Minutes Display */}
      {minutes && (
        <div className="mt-4 p-4 bg-gray-800 rounded border border-gray-600">
          <h3 className="text-lg font-bold text-gray-100 mb-2">Meeting Minutes</h3>
          <div className="text-gray-300 whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {minutes}
          </div>
        </div>
      )}
    </div>
  );
}
