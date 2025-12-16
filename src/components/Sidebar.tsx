

export interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const navItems = [
    { id: 'transcript', icon: '📝', label: 'Transcript' },
    { id: 'chat', icon: '💬', label: 'Chat Assistant' },
  ];

  return (
    <div className="w-16 md:w-20 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-6 h-screen flex-shrink-0 z-20">
      <div className="mb-8 p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
        <div className="w-6 h-6 text-white font-bold flex items-center justify-center">M</div>
      </div>

      <nav className="flex-1 flex flex-col gap-6 w-full px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`
              w-full aspect-square rounded-xl flex items-center justify-center text-xl transition-all duration-200
              ${activeTab === item.id 
                ? 'bg-gray-800 text-indigo-400 shadow-inner' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }
            `}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600"></div>
      </div>
    </div>
  );
}
