import { useEffect, useState } from 'react';

export default function AIWidget() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
      <div className="relative group">
        {/* Glowing Orb Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-40 group-hover:opacity-60 transition duration-1000 animate-pulse"></div>
        
        {/* Card Content */}
        <div className="relative flex items-center gap-4 bg-gray-900/90 backdrop-blur-md border border-gray-700/50 px-5 py-3 rounded-xl shadow-2xl">
          <div className="relative">
            {/* Visualizer bars approximation */}
            <div className="flex gap-1 items-end h-6">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-indigo-500 rounded-full animate-pulse"
                  style={{ 
                    height: '100%', 
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: '0.8s' 
                  }}
                />
              ))}
            </div>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-400">AI Active</span>
            <span className="text-sm font-mono text-gray-200 tabular-nums">{formatTime(elapsed)}</span>
          </div>

          <button className="text-gray-500 hover:text-red-400 transition-colors ml-2">
            ⏹
          </button>
        </div>
      </div>
    </div>
  );
}
