import { useRef, useEffect } from 'react';

interface TranscriptRailProps {
    transcription: string;
    isConnected: boolean;
}

export default function TranscriptRail({ transcription, isConnected }: TranscriptRailProps) {
    const endRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcription]);

    return (
        <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800 w-full sm:w-[320px] lg:w-[400px] flex-shrink-0">
            {/* Search Header */}
            <div className="p-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur z-10 sticky top-0">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search transcript..." 
                        className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg pl-9 pr-3 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-500"
                    />
                    <span className="absolute left-3 top-2.5 text-gray-500 text-xs">🔍</span>
                </div>
            </div>

            {/* Status Bar */}
            <div className={`px-4 py-2 text-xs font-semibold flex justify-between items-center ${isConnected ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'} border-b border-gray-800`}>
                <span>{isConnected ? '● LIVE CAPTURE' : '○ OFFLINE'}</span>
                <span>{transcription.length} chars</span>
            </div>

            {/* Transcript Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
                {transcription ? (
                    // In a real app we'd split by speaker/time. For now, we simulate blocks.
                    <div className="animate-fade-in">
                         {/* We wrap the text in a bubble style */}
                         <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-indigo-500/30">
                                AI
                            </div>
                            <div className="flex-1">
                                <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-sm font-semibold text-gray-200">Participant</span>
                                    <span className="text-[10px] text-gray-500 font-mono">Now</span>
                                </div>
                                <div className="p-3 bg-gray-800 rounded-2xl rounded-tl-sm border border-gray-700/50 text-gray-300 text-sm leading-relaxed shadow-sm">
                                    {transcription}
                                </div>
                            </div>
                         </div>
                    </div>
                ) : (
                   <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-2">
                       <span className="text-2xl opacity-20">💬</span>
                       <span className="text-sm">No speech detected yet...</span>
                   </div>
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
}
