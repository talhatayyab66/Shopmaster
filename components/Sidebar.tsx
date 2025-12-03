import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, Users, Settings, LogOut, Sparkles } from 'lucide-react';
import { User, ViewState, UserRole } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  user: User;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, user }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowed: ['ADMIN', 'SALES'] },
    { id: 'inventory', label: 'Inventory', icon: Package, allowed: ['ADMIN', 'SALES'] },
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart, allowed: ['ADMIN', 'SALES'] },
    { id: 'staff', label: 'Staff Management', icon: Users, allowed: ['ADMIN'] },
    { id: 'ai-assistant', label: 'AI Advisor', icon: Sparkles, allowed: ['ADMIN'] },
    { id: 'settings', label: 'Settings', icon: Settings, allowed: ['ADMIN'] },
  ];

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 overflow-y-auto z-20 transition-all duration-300">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          ShopMaster AI
        </h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{user.role}</p>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems.map((item) => {
          if (!item.allowed.includes(user.role)) return null;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as ViewState)}
              className={`flex items-center w-full px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon size={20} className="mr-3" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="mb-4 px-2">
          <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
          <p className="text-xs text-slate-500 truncate">@{user.username}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center w-full px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded-lg transition-colors"
        >
          <LogOut size={18} className="mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
