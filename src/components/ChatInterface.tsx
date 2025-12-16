import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string | JSX.Element;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "What are the next steps?",
  "Summarize the risks",
  "Who mentioned the API?",
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Fix: Use a ref to track if we've already sent the greeting to prevent double-send in Strict Mode */
  const hasInitialized = useRef(false);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Initial Greeting
  useEffect(() => {
    // Only send if empty (initial load) AND we haven't initialized yet
    if (!hasInitialized.current && messages.length === 0) {
      hasInitialized.current = true;
      setTimeout(() => {
        addMessage('ai', "Hello! I've analyzed the transcript. Ask me about the budget or deadlines.");
      }, 500);
    }
  }, []);

  const addMessage = (sender: 'user' | 'ai', text: string | JSX.Element) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      sender,
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // 1. User Message
    addMessage('user', text);
    setInputValue('');
    setIsTyping(true);

    // 2. Simulate Delay for "Thinking..."
    setTimeout(() => {
        setIsTyping(false);
        generateMockResponse(text);
    }, 1500);
  };

  const generateMockResponse = (userText: string) => {
    if (userText === "What are the next steps?") {
      const response = (
        <div className="space-y-2">
            <p>Based on the discussion, here are the immediate next steps:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li><strong>Backend Team:</strong> Finalize the API schema by Friday.</li>
                <li><strong>Design:</strong> Update the mockups for the new dashboard.</li>
                <li><strong>QA:</strong> Start creating test cases for the login flow.</li>
            </ul>
        </div>
      );
      addMessage('ai', response);
    } else {
        // Generic Placeholder
        const topic = userText.split(' ').slice(-1)[0] || "that topic";
        const response = `That's a great question about the meeting. Based on the transcript, the team discussed "${topic}" briefly. Would you like me to elaborate on specific details?`;
        addMessage('ai', response);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <span>✨</span> Meeting Assistant <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">Beta</span>
        </h2>
        <button 
            onClick={() => setMessages([])}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
            Clear Chat
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed
                ${msg.sender === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-gray-800 text-gray-200 rounded-bl-none shadow-sm border border-gray-700'}
              `}
            >
              {msg.text}
            </div>
          </div>
        ))}
        
        {isTyping && (
            <div className="flex justify-start animate-pulse">
                <div className="bg-gray-800 rounded-2xl rounded-bl-none p-3 border border-gray-700 flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-900 border-t border-gray-800">
        
        {/* Chips */}
        {messages.length < 2 && (
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {SUGGESTED_QUESTIONS.map((q) => (
                <button
                key={q}
                onClick={() => handleSendMessage(q)}
                className="whitespace-nowrap px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-xs text-indigo-300 transition-colors"
                >
                {q}
                </button>
            ))}
            </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the meeting..."
            className="w-full bg-gray-950 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            disabled={isTyping}
          />
          <button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
        <div className="text-center mt-2">
            <span className="text-[10px] text-gray-600">AI can make mistakes. Verify important info.</span>
        </div>
      </div>
    </div>
  );
}
