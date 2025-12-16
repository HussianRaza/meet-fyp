import ReactMarkdown from 'react-markdown';

interface SummaryPanelProps {
    minutes: string | null;
    error: string | null;
}

export default function SummaryPanel({ minutes, error }: SummaryPanelProps) {
    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-red-200">
                <h3 className="font-bold mb-2 text-red-100">Generation Error</h3>
                <p>{error}</p>
            </div>
        );
    }

    if (!minutes) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-8 border border-dashed border-gray-800 rounded-xl bg-gray-900/50">
                <div className="w-16 h-16 mb-4 rounded-full bg-gray-800 flex items-center justify-center text-2xl">
                    ✨
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-1">Waiting for Meeting Summary</h3>
                <p className="text-sm">Click "End & Summarize" when you're done.</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-800 bg-gray-900/50">
                <h2 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                    <span>📝</span> Meeting Minutes
                </h2>
            </div>
            <div className="p-6 prose prose-invert prose-sm max-w-none leading-relaxed text-gray-300">
                 <ReactMarkdown>
                    {minutes}
                </ReactMarkdown>
            </div>
        </div>
    );
}
