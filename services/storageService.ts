import { supabase } from './supabaseClient';
import { User, Shop, Product, Sale, UserRole } from '../types';

// Helper to generate IDs client-side
const generateId = () => crypto.randomUUID();

// --- Auth & User ---

export const createUser = async (user: Omit<User, 'id'>): Promise<User> => {
  // This function is primarily used for adding STAFF (Sales persons)
  // We do NOT use supabase.auth.signUp here because the Admin is currently logged in.
  // Instead, we store the staff credentials in the public.users table (Custom Auth for Staff).
  
  const { data: existing } = await supabase
    .from('users')
    .select('username')
    .eq('username', user.username)
    .single();

  if (existing) {
    throw new Error('Username already exists');
  }

  const newUser = { ...user, id: generateId() };

  const dbUser = {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    role: newUser.role,
    shop_id: newUser.shopId,
    password_hash: newUser.passwordHash, // Storing plain/hashed password for staff custom auth
    full_name: newUser.fullName
  };

  const { error } = await supabase.from('users').insert(dbUser);
  if (error) throw new Error(error.message);

  return newUser;
};

export const createShop = async (shopName: string, adminData: { fullName: string; username: string; email: string; password: string }) => {
  // 1. Register Admin in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: adminData.email,
    password: adminData.password,
    options: {
      data: {
        full_name: adminData.fullName,
        username: adminData.username,
      }
    }
  });

  if (authError) throw new Error(`Auth Registration failed: ${authError.message}`);
  if (!authData.user) throw new Error("User creation failed");

  const userId = authData.user.id; // Use the Auth ID
  const shopId = generateId();

  // 2. Create Shop
  const newShop: Shop = {
    id: shopId,
    name: shopName,
    ownerId: userId,
    createdAt: Date.now(),
  };

  const dbShop = {
    id: newShop.id,
    name: newShop.name,
    owner_id: newShop.ownerId,
    created_at: newShop.createdAt
  };

  // 3. Create Admin User Profile in public table
  const adminUser: User = {
    id: userId,
    username: adminData.username,
    passwordHash: 'SUPABASE_AUTH', // Managed by Supabase
    fullName: adminData.fullName,
    email: adminData.email,
    role: UserRole.ADMIN,
    shopId: shopId
  };

  const dbUser = {
    id: adminUser.id,
    username: adminUser.username,
    email: adminUser.email,
    role: adminUser.role,
    shop_id: adminUser.shopId,
    password_hash: adminUser.passwordHash,
    full_name: adminUser.fullName
  };

  const { error: shopError } = await supabase.from('shops').insert(dbShop);
  if (shopError) throw new Error(`Shop creation failed: ${shopError.message}`);

  const { error: userError } = await supabase.from('users').insert(dbUser);
  if (userError) {
    // Cleanup is harder with Auth user created, but for MVP we throw
    throw new Error(`User profile creation failed: ${userError.message}`);
  }

  return { shop: newShop, user: adminUser };
};

export const loginUser = async (identifier: string, password: string): Promise<{ user: User; shop: Shop } | null> => {
  // Strategy: 
  // 1. Try Supabase Auth (for Admins who use Email)
  // 2. If valid email format, try auth.signIn
  // 3. If that fails or not email, try custom DB auth (for Staff who use Username)

  let userId: string | null = null;
  let isSupabaseAuth = false;

  // Check if identifier looks like an email
  const isEmail = identifier.includes('@');

  if (isEmail) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password: password
    });

    if (!error && data.user) {
      userId = data.user.id;
      isSupabaseAuth = true;
    }
  }

  // Fallback to Custom Auth for Staff (or Admin login by username if we supported that, but we'll stick to staff)
  if (!userId) {
    // Manual check in users table
    const { data: staffData, error: staffError } = await supabase
      .from('users')
      .select('*')
      .eq('username', identifier)
      .eq('password_hash', password) // Comparing plain stored password for staff
      .single();

    if (staffData && !staffError) {
      userId = staffData.id;
    }
  }

  if (!userId) return null;

  // Fetch Full User Profile & Shop
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (userError || !userData) return null;

  const { data: shopData, error: shopError } = await supabase
    .from('shops')
    .select('*')
    .eq('id', userData.shop_id)
    .single();

  if (shopError || !shopData) return null;

  const user: User = {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    role: userData.role as UserRole,
    shopId: userData.shop_id,
    passwordHash: userData.password_hash,
    fullName: userData.full_name
  };

  const shop: Shop = {
    id: shopData.id,
    name: shopData.name,
    ownerId: shopData.owner_id,
    createdAt: Number(shopData.created_at)
  };

  return { user, shop };
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
};

export const getUsersByShop = async (shopId: string): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('shop_id', shopId);

  if (error) throw new Error(error.message);

  return (data || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role as UserRole,
    shopId: u.shop_id,
    passwordHash: u.password_hash,
    fullName: u.full_name
  }));
};

export const deleteUser = async (userId: string) => {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw new Error(error.message);
};

// --- Products ---

export const getProducts = async (shopId: string): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId);

  if (error) throw new Error(error.message);

  return (data || []).map((p: any) => ({
    id: p.id,
    shopId: p.shop_id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    costPrice: Number(p.cost_price),
    stock: Number(p.stock),
    minStockLevel: Number(p.min_stock_level),
    sku: p.sku
  }));
};

export const saveProduct = async (product: Omit<Product, 'id'> & { id?: string }) => {
  const isUpdate = !!product.id;
  const productId = product.id || generateId();

  const dbProduct = {
    id: productId,
    shop_id: product.shopId,
    name: product.name,
    category: product.category,
    price: product.price,
    cost_price: product.costPrice,
    stock: product.stock,
    min_stock_level: product.minStockLevel,
    sku: product.sku
  };

  if (isUpdate) {
    const { error } = await supabase
      .from('products')
      .update(dbProduct)
      .eq('id', productId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('products')
      .insert(dbProduct);
    if (error) throw new Error(error.message);
  }
};

export const deleteProduct = async (productId: string) => {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw new Error(error.message);
};

// --- Sales ---

export const createSale = async (saleData: Omit<Sale, 'id'>) => {
  const saleId = generateId();

  // 1. Update Stock
  for (const item of saleData.items) {
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.productId)
      .single();
    
    if (product) {
      const currentStock = Number(product.stock);
      await supabase
        .from('products')
        .update({ stock: currentStock - item.quantity })
        .eq('id', item.productId);
    }
  }

  // 2. Save Sale
  const dbSale = {
    id: saleId,
    shop_id: saleData.shopId,
    seller_id: saleData.sellerId,
    seller_name: saleData.sellerName,
    items: saleData.items, // JSONB
    total_amount: saleData.totalAmount,
    timestamp: saleData.timestamp,
    invoice_id: saleData.invoiceId
  };

  const { error } = await supabase.from('sales').insert(dbSale);
  if (error) throw new Error(error.message);

  return { ...saleData, id: saleId };
};

export const getSales = async (shopId: string): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('shop_id', shopId)
    .order('timestamp', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((s: any) => ({
    id: s.id,
    shopId: s.shop_id,
    sellerId: s.seller_id,
    sellerName: s.seller_name,
    items: s.items,
    totalAmount: Number(s.total_amount),
    timestamp: Number(s.timestamp),
    invoiceId: s.invoice_id
  }));
};
