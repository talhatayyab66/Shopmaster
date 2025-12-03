import React, { useState, useEffect } from 'react';
import { User, Shop, ViewState, Product, Sale, UserRole } from './types';
import Sidebar from './components/Sidebar';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Staff from './components/Staff';
import ShopChat from './components/ShopChat';
import AIAssistant from './components/AIAssistant';
import Settings from './components/Settings';
import { 
  getProducts, 
  saveProduct, 
  deleteProduct, 
  getSales, 
  createSale, 
  getUsersByShop,
  logoutUser
} from './services/storageService';
import { supabase } from './services/supabaseClient';

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Restore session for Supabase Auth Users (Admins)
  useEffect(() => {
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch User and Shop data for this session
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (userData) {
          const { data: shopData } = await supabase
            .from('shops')
            .select('*')
            .eq('id', userData.shop_id)
            .single();

          if (shopData) {
            setUser({
              id: userData.id,
              username: userData.username,
              email: userData.email,
              role: userData.role as UserRole,
              shopId: userData.shop_id,
              passwordHash: userData.password_hash,
              fullName: userData.full_name
            });
            setShop({
              id: shopData.id,
              name: shopData.name,
              ownerId: shopData.owner_id,
              createdAt: Number(shopData.created_at),
              address: shopData.address,
              currency: shopData.currency || '$',
              logoUrl: shopData.logo_url
            });
          }
        }
      }
    };
    
    restoreSession();
  }, []);

  // Fetch Data when user/shop changes
  useEffect(() => {
    if (user && shop) {
      refreshData();
      if (user.role === 'SALES') {
        setCurrentView('pos'); // Sales landing page
      } else {
        setCurrentView('dashboard'); // Admin landing
      }
    }
  }, [user, shop]);

  const refreshData = async () => {
    if (!shop) return;
    setLoading(true);
    try {
      const [fetchedProducts, fetchedSales] = await Promise.all([
        getProducts(shop.id),
        getSales(shop.id)
      ]);
      
      setProducts(fetchedProducts);
      setSales(fetchedSales);

      if (user?.role === 'ADMIN') {
        const fetchedStaff = await getUsersByShop(shop.id);
        setStaffList(fetchedStaff);
      }
      
      // Refresh shop data in case settings changed
      const { data: latestShop } = await supabase.from('shops').select('*').eq('id', shop.id).single();
      if (latestShop) {
         setShop(prev => prev ? ({...prev, name: latestShop.name, address: latestShop.address, currency: latestShop.currency, logoUrl: latestShop.logo_url}) : null);
      }

    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (loggedInUser: User, loggedInShop: Shop) => {
    setUser(loggedInUser);
    setShop(loggedInShop);
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setShop(null);
    setCurrentView('dashboard');
    setProducts([]);
    setSales([]);
    setStaffList([]);
  };

  if (!user || !shop) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row transition-colors duration-300">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        onLogout={handleLogout}
        user={user}
        shop={shop}
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
      />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen mb-16 md:mb-0">
        <header className="flex justify-between items-center mb-6 md:mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white capitalize">
              {currentView.replace('-', ' ')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">Welcome back, {user.fullName}</p>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {loading && <span className="text-xs md:text-sm text-blue-600 animate-pulse">Syncing...</span>}
            <div className="bg-white dark:bg-slate-800 px-3 py-1.5 md:px-4 md:py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-200">{shop.name}</span>
            </div>
          </div>
        </header>

        <div className="animate-[fadeIn_0.3s_ease-out]">
          {currentView === 'dashboard' && (
            <Dashboard sales={sales} products={products} currency={shop.currency || '$'} />
          )}

          {currentView === 'inventory' && (
            <Inventory 
              products={products} 
              user={user}
              onSave={async (p) => {
                await saveProduct(p);
                await refreshData();
              }}
              onDelete={async (id) => {
                await deleteProduct(id);
                await refreshData();
              }}
            />
          )}

          {currentView === 'pos' && (
            <POS 
              products={products} 
              user={user} 
              shop={shop}
              onCompleteSale={async (items, total) => {
                const saleItems = items.map(i => ({
                  productId: i.id,
                  productName: i.name,
                  quantity: i.quantity,
                  priceAtSale: i.price,
                  subtotal: i.price * i.quantity
                }));
                
                await createSale({
                  shopId: shop.id,
                  sellerId: user.id,
                  sellerName: user.fullName,
                  items: saleItems,
                  totalAmount: total,
                  timestamp: Date.now(),
                  invoiceId: `INV-${Date.now()}`
                });
                await refreshData();
              }}
            />
          )}

          {currentView === 'chat' && (
            <ShopChat user={user} shopId={shop.id} />
          )}

          {currentView === 'staff' && user.role === 'ADMIN' && (
            <Staff 
              staff={staffList} 
              shopId={shop.id} 
              refreshStaff={refreshData} 
            />
          )}

          {currentView === 'ai-assistant' && user.role === 'ADMIN' && (
            <AIAssistant products={products} sales={sales} />
          )}
          
          {currentView === 'settings' && (
            <Settings 
              user={user} 
              shop={shop} 
              refreshShop={refreshData}
              isDarkMode={isDarkMode}
              toggleTheme={() => setIsDarkMode(!isDarkMode)}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;