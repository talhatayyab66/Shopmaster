import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, Users, Settings, LogOut, MessageCircle, Moon, Sun, FileText, Monitor } from 'lucide-react';
import { User, ViewState, Shop } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  user: User;
  shop?: Shop;
  isDarkMode: boolean;
  toggleTheme: () => void;
  unreadCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, user, shop, isDarkMode, toggleTheme, unreadCount = 0 }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowed: ['ADMIN', 'SALES'] },
    { id: 'inventory', label: 'Inventory', icon: Package, allowed: ['ADMIN', 'SALES'] },
    { id: 'pos', label: 'POS', icon: ShoppingCart, allowed: ['ADMIN', 'SALES'] },
    { id: 'orders', label: 'Orders', icon: FileText, allowed: ['ADMIN', 'SALES'] },
    { id: 'chat', label: 'Chat', icon: MessageCircle, allowed: ['ADMIN', 'SALES'] },
    { id: 'staff', label: 'Staff', icon: Users, allowed: ['ADMIN'] },
    { id: 'settings', label: 'Settings', icon: Settings, allowed: ['ADMIN', 'SALES'] },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-screen w-64 bg-slate-900 text-white flex-col fixed left-0 top-0 overflow-y-auto z-20 transition-all duration-300">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            {shop?.logoUrl ? (
              <img src={shop.logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain bg-white" />
            ) : (
              <div className="relative w-10 h-10 flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center text-white shadow-lg">
                      <Monitor size={20} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-[2px]">
                      <div className="bg-white rounded-full p-[3px]">
                        <ShoppingCart size={10} className="text-primary-600" />
                      </div>
                  </div>
              </div>
            )}
            <div className="overflow-hidden">
               <h1 className="text-lg font-bold truncate">{shop?.name || 'POS PRO'}</h1>
               {shop?.address && <p className="text-[10px] text-slate-400 truncate">{shop.address}</p>}
            </div>
          </div>
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
                className={`flex items-center w-full px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                  isActive 
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon size={20} className="mr-3" />
                {item.label}
                {item.id === 'chat' && unreadCount > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm animate-pulse"></span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
             onClick={toggleTheme}
             className="flex items-center w-full px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isDarkMode ? <Sun size={18} className="mr-3" /> : <Moon size={18} className="mr-3" />}
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          
          <div className="px-2 pt-2">
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

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 flex justify-around items-center px-2 py-2">
        {menuItems.slice(0, 5).map((item) => {
           if (!item.allowed.includes(user.role)) return null;
           const isActive = currentView === item.id;
           return (
             <button
               key={item.id}
               onClick={() => onChangeView(item.id as ViewState)}
               className={`flex flex-col items-center justify-center p-2 rounded-lg w-full transition-colors relative ${
                 isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
               }`}
             >
               <item.icon size={20} className={isActive ? 'fill-current opacity-20' : ''} />
               {item.id === 'chat' && unreadCount > 0 && (
                  <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full shadow-sm"></span>
               )}
               <span className="text-[10px] font-medium mt-1">{item.label}</span>
             </button>
           );
        })}
        <button
          onClick={() => onChangeView('settings')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg w-full transition-colors ${currentView === 'settings' ? 'text-primary-600' : 'text-slate-400'}`}
        >
          <Settings size={20} />
           <span className="text-[10px] font-medium mt-1">Set</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;