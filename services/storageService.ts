import { supabase } from './supabaseClient';
import { User, Shop, Product, Sale, UserRole } from '../types';

// Helper to generate IDs client-side to maintain similarity with previous logic
const generateId = () => crypto.randomUUID();

// --- Auth & User ---

export const createUser = async (user: Omit<User, 'id'>): Promise<User> => {
  // Check duplicates
  const { data: existing } = await supabase
    .from('users')
    .select('username')
    .eq('username', user.username)
    .single();

  if (existing) {
    throw new Error('Username already exists');
  }

  const newUser = { ...user, id: generateId() };

  // Map to DB columns
  const dbUser = {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    role: newUser.role,
    shop_id: newUser.shopId,
    password_hash: newUser.passwordHash,
    full_name: newUser.fullName
  };

  const { error } = await supabase.from('users').insert(dbUser);
  if (error) throw new Error(error.message);

  return newUser;
};

export const createShop = async (shopName: string, adminData: { fullName: string; username: string; email: string; password: string }) => {
  const shopId = generateId();
  const userId = generateId();

  // Create Shop
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

  // Create Admin User
  const adminUser: User = {
    id: userId,
    username: adminData.username,
    passwordHash: adminData.password,
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

  // Execute Supabase calls
  // Note: ideally this should be a transaction or RPC, but doing sequential for simplicity
  const { error: shopError } = await supabase.from('shops').insert(dbShop);
  if (shopError) throw new Error(`Shop creation failed: ${shopError.message}`);

  const { error: userError } = await supabase.from('users').insert(dbUser);
  if (userError) {
    // Cleanup shop if user creation fails
    await supabase.from('shops').delete().eq('id', shopId);
    throw new Error(`User creation failed: ${userError.message}`);
  }

  return { shop: newShop, user: adminUser };
};

export const loginUser = async (username: string, password: string): Promise<{ user: User; shop: Shop } | null> => {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('password_hash', password) // In production, use Supabase Auth or proper hashing comparison
    .single();
  
  if (userError || !userData) return null;

  const { data: shopData, error: shopError } = await supabase
    .from('shops')
    .select('*')
    .eq('id', userData.shop_id)
    .single();

  if (shopError || !shopData) return null;

  // Map DB to Types
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
  // This should ideally be transactional. We will loop update for simplicity here.
  for (const item of saleData.items) {
    // Fetch current stock
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
