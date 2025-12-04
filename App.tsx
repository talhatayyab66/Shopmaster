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

// Theme Color Palettes (RGB values for Tailwind)
const THEMES: Record<string, any> = {
  blue: {
    50: '239 246 255',
    100: '219 234 254',
    200: '191 219 254',
    300: '147 197 253',
    400: '96 165 250',
    500: '59 130 246',
    600: '37 99 235',
    700: '29 78 216',
    800: '30 64 175',
    900: '30 58 138',
    hex: '#2563eb' // 600 shade for charts
  },
  purple: {
    50: '250 245 255',
    100: '243 232 255',
    200: '233 213 255',
    300: '216 180 254',
    400: '192 132 252',
    500: '168 85 247',
    600: '147 51 234',
    700: '126 34 206',
    800: '107 33 168',
    900: '88 28 135',
    hex: '#9333ea'
  },
  emerald: {
    50: '236 253 245',
    100: '209 250 229',
    200: '167 243 208',
    300: '110 231 183',
    400: '52 211 153',
    500: '16 185 129',
    600: '5 150 105',
    700: '4 120 87',
    800: '6 95 70',
    900: '6 78 59',
    hex: '#059669'
  },
  rose: {
    50: '255 241 242',
    100: '255 228 230',
    200: '254 205 211',
    300: '253 164 175',
    400: '251 113 133',
    500: '244 63 94',
    600: '225 29 72',
    700: '190 18 60',
    800: '159 18 57',
    900: '136 19 55',
    hex: '#e11d48'
  },
  orange: {
    50: '255 247 237',
    100: '255 237 213',
    200: '254 215 170',
    300: '253 186 116',
    400: '251 146 60',
    500: '249 115 22',
    600: '234 88 12',
    700: '194 65 12',
    800: '154 52 18',
    900: '124 45 18',
    hex: '#ea580c'
  }
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
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem('themeColor') || 'blue';
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
    const palette = THEMES[themeColor] || THEMES['blue'];
    const root = document.documentElement;
    
    // Set CSS variables for Tailwind primary color
    Object.keys(palette).forEach(key => {
      if (key !== 'hex') {
        root.style.setProperty(`--primary-${key}`, palette[key]);
      }
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
          <Dashboard 
            sales={sales} 
            products={products} 
            currency={shop.currency || '$'} 
            themeColorHex={THEMES[themeColor].hex}
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
            themeColor={themeColor}
            setThemeColor={setThemeColor}
          />
        );
      default:
        return (
          <Dashboard 
            sales={sales} 
            products={products} 
            currency={shop.currency || '$'} 
            themeColorHex={THEMES[themeColor].hex}
          />
        );
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