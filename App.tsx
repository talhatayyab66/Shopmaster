import React, { useState, useEffect } from 'react';
import { User, Shop, ViewState, Product, Sale, UserRole } from './types';
import Sidebar from './components/Sidebar';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import SalesHistory from './components/SalesHistory';
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
  subscribeToChat,
  clearSalesHistory
} from './services/storageService';
import { supabase } from './services/supabaseClient';

// Helper functions for dynamic palette generation
const hexToRgb = (hex: string) => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 37, g: 99, b: 235 }; // Default blue
};

const mix = (c1: {r:number, g:number, b:number}, c2: {r:number, g:number, b:number}, weight: number) => {
  return {
    r: Math.round(c1.r * weight + c2.r * (1 - weight)),
    g: Math.round(c1.g * weight + c2.g * (1 - weight)),
    b: Math.round(c1.b * weight + c2.b * (1 - weight))
  };
};

const generatePalette = (hex: string) => {
  const base = hexToRgb(hex);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 15, g: 23, b: 42 }; // Slate-900ish for rich darks

  // Generate shades: 50-900
  // 50-400: Mix base with white
  // 500: Base
  // 600-900: Mix base with black
  const palette: any = {
    50: mix(white, base, 0.95),
    100: mix(white, base, 0.9),
    200: mix(white, base, 0.8),
    300: mix(white, base, 0.6),
    400: mix(white, base, 0.3),
    500: base,
    600: mix(black, base, 0.1),
    700: mix(black, base, 0.3),
    800: mix(black, base, 0.5),
    900: mix(black, base, 0.7),
  };

  const cssVars: Record<string, string> = {};
  Object.keys(palette).forEach(key => {
    const c = palette[key];
    cssVars[key] = `${c.r} ${c.g} ${c.b}`;
  });
  
  return { cssVars, hex };
};

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
  
  // Navigation State
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low-stock'>('all');

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  
  // Initialize themeColor from storage. 
  // If it's a legacy name (e.g. 'blue'), map it to hex. Default to blue hex.
  const [themeColor, setThemeColor] = useState(() => {
    const stored = localStorage.getItem('themeColor');
    const LEGACY_COLORS: Record<string, string> = {
      blue: '#2563eb',
      purple: '#9333ea',
      emerald: '#059669',
      rose: '#e11d48',
      orange: '#ea580c'
    };
    return stored ? (LEGACY_COLORS[stored] || stored) : '#2563eb';
  });

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Notification State
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Apply Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Apply Theme Color
  useEffect(() => {
    const { cssVars } = generatePalette(themeColor);
    const root = document.documentElement;
    
    // Set CSS variables for Tailwind primary color
    Object.keys(cssVars).forEach(key => {
      root.style.setProperty(`--primary-${key}`, cssVars[key]);
    });

    localStorage.setItem('themeColor', themeColor);
  }, [themeColor]);

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
              logoUrl: shopData.logo_url,
              businessType: shopData.business_type || 'SHOP'
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
            logoUrl: latestShop.logo_url,
            businessType: latestShop.business_type || 'SHOP'
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

  const handleCompleteSale = async (items: any[], total: number, extras?: any) => {
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
      invoiceId: `INV-${Date.now().toString().slice(-6)}`,
      ...extras
    };

    await createSale(saleData);
    await refreshData();
  };

  const handleClearHistory = async () => {
    if (!shop) return;
    if (window.confirm("Are you sure you want to CLEAR ALL sales history? This action cannot be undone.")) {
      setLoading(true);
      try {
        await clearSalesHistory(shop.id);
        await refreshData();
      } catch (e: any) {
        alert("Failed to clear history: " + e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handler for dashboard interactivity
  const handleDashboardNavigation = (view: 'inventory' | 'orders', filter?: 'low-stock') => {
    if (filter) {
        setInventoryFilter(filter);
    } else {
        setInventoryFilter('all');
    }
    setCurrentView(view);
  };

  // Wrapper for Sidebar navigation to reset filters
  const handleViewChange = (view: ViewState) => {
    if (view === 'inventory') {
        setInventoryFilter('all');
    }
    setCurrentView(view);
  }

  if (!user || !shop) {
    return <Auth onLogin={(u, s) => { setUser(u); setShop(s); }} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return user.role === UserRole.ADMIN ? (
          <Dashboard 
            sales={sales} 
            products={products} 
            currency={shop.currency || '$'} 
            themeColorHex={themeColor}
            onNavigate={handleDashboardNavigation}
          />
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
            defaultFilter={inventoryFilter}
            currency={shop.currency || '$'}
            businessType={shop.businessType}
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
      case 'orders':
        return (
          <SalesHistory 
             sales={sales}
             shop={shop}
             currency={shop.currency || '$'}
             userRole={user.role}
             onClearHistory={handleClearHistory}
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
            themeColor={themeColor}
            setThemeColor={setThemeColor}
            onLogout={handleLogout}
          />
        );
      default:
        return (
          <Dashboard 
            sales={sales} 
            products={products} 
            currency={shop.currency || '$'} 
            themeColorHex={themeColor}
            onNavigate={handleDashboardNavigation}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Sidebar 
        currentView={currentView} 
        onChangeView={handleViewChange} 
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