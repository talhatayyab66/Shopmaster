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
import EmailConfirmedPage from './app/authenticate/page';
import { 
  getProducts, 
  saveProduct, 
  deleteProduct, 
  getSales, 
  createSale, 
  getUsersByShop,
  logoutUser,
  subscribeToShopUpdates,
  subscribeToChat
} from './services/storageService';
import { supabase } from './services/supabaseClient';

const App = () => {
  // Simple Manual Routing Check
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Return early if on the authenticate page
  if (pathname === '/authenticate' || pathname === '/authenticate/') {
    return <EmailConfirmedPage />;
  }

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
  
  // Notification State
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

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
    if (user?.id && shop?.id) {
      refreshData();
      
      // Initial routing logic
      if (user.role === 'SALES' && currentView === 'dashboard') {
        setCurrentView('pos'); 
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, shop?.id]); 

  // Real-time listener for Shop Settings & Global Notifications
  useEffect(() => {
    if (!shop?.id || !user?.id) return;

    // 1. Subscribe to Shop Updates
    const shopSub = subscribeToShopUpdates(shop.id, (updates) => {
      setShop(prev => {
        if (!prev) return null;
        return { ...prev, ...updates };
      });
    });

    // 2. Subscribe to Chat for Notifications (Global)
    const chatSub = subscribeToChat(shop.id, {
      onInsert: (msg) => {
        // If chat is NOT active, or message is NOT from me
        if (currentView !== 'chat' && msg.userId !== user.id) {
           setUnreadChatCount(prev => prev + 1);
        }
      },
      onDelete: () => {}, // No op for notifications
      onUpdate: () => {}
    });

    return () => {
      shopSub.unsubscribe();
      chatSub.unsubscribe();
    };
  }, [shop?.id, user?.id, currentView]);

  // Reset unread count when opening chat
  useEffect(() => {
    if (currentView === 'chat') {
      setUnreadChatCount(0);
    }
  }, [currentView]);

  const refreshData = async () => {
    if (!shop || !user) return;
    setLoading(true);
    try {
      const [fetchedProducts, fetchedSales] = await Promise.all([
        getProducts(shop.id),
        getSales(shop.id)
      ]);
      
      setProducts(fetchedProducts);
      setSales(fetchedSales);

      if (user.role === UserRole.ADMIN) {
        const fetchedStaff = await getUsersByShop(shop.id);
        setStaffList(fetchedStaff);
      }

      // Check for Shop updates
      const { data: latestShop } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shop.id)
        .single();
      
      if (latestShop) {
        if (
          latestShop.name !== shop.name ||
          latestShop.address !== shop.address ||
          latestShop.currency !== shop.currency ||
          latestShop.logo_url !== shop.logoUrl
        ) {
          setShop(prev => prev ? ({
            ...prev,
            name: latestShop.name,
            address: latestShop.address,
            currency: latestShop.currency || '$',
            logoUrl: latestShop.logo_url
          }) : null);
        }
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setShop(null);
    setCurrentView('dashboard');
  };

  const handleSaveProduct = async (product: any) => {
    await saveProduct(product);
    await refreshData();
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    await refreshData();
  };

  const handleCompleteSale = async (items: any[], total: number) => {
    if (!shop || !user) return;
    
    const saleData = {
      shopId: shop.id,
      sellerId: user.id,
      sellerName: user.fullName,
      items: items.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        priceAtSale: item.price,
        subtotal: item.price * item.quantity
      })),
      totalAmount: total,
      timestamp: Date.now(),
      invoiceId: `INV-${Date.now().toString().slice(-6)}`
    };

    await createSale(saleData);
    await refreshData();
  };

  if (!user || !shop) {
    return <Auth onLogin={(u, s) => { setUser(u); setShop(s); }} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return user.role === UserRole.ADMIN ? (
          <Dashboard sales={sales} products={products} currency={shop.currency || '$'} />
        ) : (
          <div className="text-center mt-20 text-slate-500">Access Restricted</div>
        );
      case 'inventory':
        return (
          <Inventory 
            products={products} 
            user={user} 
            onSave={handleSaveProduct} 
            onDelete={handleDeleteProduct} 
          />
        );
      case 'pos':
        return (
          <POS 
            products={products} 
            user={user} 
            shop={shop}
            onCompleteSale={handleCompleteSale} 
          />
        );
      case 'staff':
        return user.role === UserRole.ADMIN ? (
          <Staff staff={staffList} shopId={shop.id} refreshStaff={refreshData} />
        ) : (
           <div className="text-center mt-20 text-slate-500">Access Restricted</div>
        );
      case 'ai-assistant':
        return user.role === UserRole.ADMIN ? (
          <AIAssistant products={products} sales={sales} />
        ) : (
           <div className="text-center mt-20 text-slate-500">Access Restricted</div>
        );
      case 'chat':
        return <ShopChat user={user} shopId={shop.id} />;
      case 'settings':
        return (
          <Settings 
            user={user} 
            shop={shop} 
            refreshShop={refreshData} 
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
        );
      default:
        return <Dashboard sales={sales} products={products} currency={shop.currency || '$'} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        onLogout={handleLogout} 
        user={user} 
        shop={shop}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        unreadCount={unreadChatCount}
      />
      
      {/* Main Content Area - adjusted for fixed sidebar */}
      <main className="md:ml-64 min-h-screen p-4 md:p-8 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;