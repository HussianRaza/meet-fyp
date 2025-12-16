export default function MeetingHeader({ onGenerateMinutes, isGenerating, hasTranscript }: { 
    onGenerateMinutes: () => void;
    isGenerating: boolean;
    hasTranscript: boolean;
}) {
    return (
      <header className="flex justify-between items-center px-8 py-6 border-b border-gray-800/50 bg-gray-900/30 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Meeting Minutes</h1>
            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">Live</span>
          </div>
          <p className="text-gray-500 text-sm">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
  
        <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors border border-gray-700">
                Share
            </button>
            <button 
                onClick={onGenerateMinutes}
                disabled={isGenerating || !hasTranscript}
                className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20
                    ${isGenerating || !hasTranscript
                        ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-transparent'
                    }
                `}
            >
                {isGenerating ? 'Generating Minutes...' : 'End & Summarize'}
            </button>
        </div>
      </header>
    );
  }
