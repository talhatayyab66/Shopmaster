import { supabase } from './supabaseClient';
import { User, Shop, Product, Sale, UserRole, Message, BusinessType } from '../types';

// Helper to generate IDs client-side
const generateId = () => crypto.randomUUID();

// --- Auth & User ---

export const createUser = async (user: Omit<User, 'id'>): Promise<User> => {
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
    password_hash: newUser.passwordHash,
    full_name: newUser.fullName
  };

  const { error } = await supabase.from('users').insert(dbUser);
  if (error) throw new Error(error.message);

  return newUser;
};

export const createShop = async (shopName: string, businessType: BusinessType, adminData: { fullName: string; username: string; email: string; password: string }) => {
  // 1. Register Admin in Supabase Auth
  // We include shop_name in metadata so we can create the shop record later if email confirmation interrupts the flow
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: adminData.email,
    password: adminData.password,
    options: {
      data: {
        full_name: adminData.fullName,
        username: adminData.username,
        shop_name: shopName,
        business_type: businessType
      }
    }
  });

  if (authError) throw new Error(`Auth Registration failed: ${authError.message}`);
  if (!authData.user) throw new Error("User creation failed");

  const userId = authData.user.id;
  const shopId = generateId();
  
  // If session is null, email confirmation is required/enabled.
  const confirmationRequired = !authData.session;

  if (confirmationRequired) {
    // Return dummies, they won't be used by UI when confirmationRequired is true
    return { shop: null as unknown as Shop, user: null as unknown as User, confirmationRequired: true };
  }

  // If we have a session (no verification required), proceed to create records immediately
  
  // 2. Create Shop
  const newShop: Shop = {
    id: shopId,
    name: shopName,
    ownerId: userId,
    createdAt: Date.now(),
    currency: '$',
    businessType: businessType
  };

  const dbShop = {
    id: newShop.id,
    name: newShop.name,
    owner_id: newShop.ownerId,
    created_at: newShop.createdAt,
    currency: '$',
    business_type: businessType
  };

  // 3. Create Admin User Profile in public table
  const adminUser: User = {
    id: userId,
    username: adminData.username,
    passwordHash: 'SUPABASE_AUTH',
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
    throw new Error(`User profile creation failed: ${userError.message}`);
  }

  return { shop: newShop, user: adminUser, confirmationRequired: false };
};

export const updateShop = async (shop: Partial<Shop> & { id: string }) => {
  const updates: any = {};
  if (shop.name) updates.name = shop.name;
  if (shop.address) updates.address = shop.address;
  if (shop.currency) updates.currency = shop.currency;
  if (shop.logoUrl) updates.logo_url = shop.logoUrl;
  // Business Type typically doesn't change after creation for data consistency, but could be added here.

  const { error } = await supabase
    .from('shops')
    .update(updates)
    .eq('id', shop.id);

  if (error) throw new Error(error.message);
};

export const subscribeToShopUpdates = (shopId: string, callback: (shopUpdates: Partial<Shop>) => void) => {
  return supabase
    .channel('shop-updates-' + shopId)
    .on(
      'postgres_changes',
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'shops',
        filter: `id=eq.${shopId}`
      },
      (payload: any) => {
        const newData = payload.new;
        // Map snake_case DB fields to camelCase Shop interface
        const updates: Partial<Shop> = {
          name: newData.name,
          address: newData.address,
          currency: newData.currency,
          logoUrl: newData.logo_url,
          businessType: newData.business_type
        };
        callback(updates);
      }
    )
    .subscribe();
};

export const uploadShopLogo = async (shopId: string, file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = `logo_${Date.now()}.${fileExt}`;
  const filePath = `${shopId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('shop-assets')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Shop Logo Upload Error:", uploadError);
    throw new Error('Logo upload failed: ' + uploadError.message);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('shop-assets')
    .getPublicUrl(filePath);
  
  return publicUrl;
};

export const loginUser = async (identifier: string, password: string): Promise<{ user: User; shop: Shop } | null> => {
  let userId: string | null = null;
  const isEmail = identifier.includes('@');

  // Case 1: Supabase Auth (Admin/Owner) with Email
  if (isEmail) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password: password
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      userId = data.user.id;

      // Check if the public user profile exists
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      // If user exists in Auth but NOT in public 'users' table
      if (!userData) {
        console.log("User authenticated in Auth but missing public profile. Attempting deferred creation.");
        const metadata = data.user.user_metadata;

        if (metadata && metadata.shop_name) {
          try {
            const shopId = generateId();

            const newShop: Shop = {
              id: shopId,
              name: metadata.shop_name,
              ownerId: userId,
              createdAt: Date.now(),
              currency: '$',
              businessType: metadata.business_type || 'SHOP'
            };

            const newUser: User = {
              id: userId,
              username: metadata.username || identifier.split('@')[0],
              passwordHash: 'SUPABASE_AUTH',
              fullName: metadata.full_name || 'Admin',
              email: data.user.email,
              role: UserRole.ADMIN,
              shopId: shopId
            };

            // Insert Shop
            const { error: shopInsertError } = await supabase.from('shops').insert({
              id: newShop.id,
              name: newShop.name,
              owner_id: newShop.ownerId,
              created_at: newShop.createdAt,
              currency: newShop.currency,
              business_type: newShop.businessType
            });

            if (shopInsertError) throw new Error("Failed to initialize shop: " + shopInsertError.message);

            // Insert User
            const { error: userInsertError } = await supabase.from('users').insert({
              id: newUser.id,
              username: newUser.username,
              email: newUser.email,
              role: newUser.role,
              shop_id: newUser.shopId,
              password_hash: newUser.passwordHash,
              full_name: newUser.fullName
            });

            if (userInsertError) throw new Error("Failed to initialize user profile: " + userInsertError.message);

            return { user: newUser, shop: newShop };

          } catch (creationError: any) {
            throw new Error(creationError.message);
          }
        } else {
           throw new Error("Account exists, but profile setup is incomplete.");
        }
      }
    }
  }

  // Case 2: Username Login (Staff OR Admin fallback)
  if (!userId && !isEmail) {
    const { data: userByUsername } = await supabase
      .from('users')
      .select('*')
      .eq('username', identifier)
      .single();

    if (userByUsername) {
      if (userByUsername.role === UserRole.ADMIN) {
        if (userByUsername.email) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: userByUsername.email,
            password: password
          });
          if (!error && data.user) userId = data.user.id;
        }
      } 
      else if (userByUsername.password_hash === password) {
        userId = userByUsername.id;
      }
    }
  }

  if (!userId) return null;

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (userError || !userData) {
      if (isEmail) throw new Error("User profile not found in database.");
      return null;
  }

  const { data: shopData, error: shopError } = await supabase
    .from('shops')
    .select('*')
    .eq('id', userData.shop_id)
    .single();

  if (shopError || !shopData) throw new Error("Shop data not found.");

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
    createdAt: Number(shopData.created_at),
    address: shopData.address,
    currency: shopData.currency || '$',
    logoUrl: shopData.logo_url,
    businessType: shopData.business_type || 'SHOP'
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
    sku: p.sku,
    formula: p.formula, // Pharmacy specific
    brand: p.brand      // Pharmacy specific
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
    sku: product.sku,
    formula: product.formula,
    brand: product.brand
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

export const bulkUpsertProducts = async (products: Product[]) => {
  if (products.length === 0) return;
  
  const dbProducts = products.map(p => ({
    id: p.id,
    shop_id: p.shopId,
    name: p.name,
    category: p.category,
    price: p.price,
    cost_price: p.costPrice,
    stock: p.stock,
    min_stock_level: p.minStockLevel,
    sku: p.sku,
    formula: p.formula,
    brand: p.brand
  }));

  const { error } = await supabase.from('products').upsert(dbProducts);
  if (error) throw new Error(error.message);
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
    invoice_id: saleData.invoiceId,
    // New Fields
    patient_name: saleData.patientName,
    diagnosis: saleData.diagnosis,
    customer_name: saleData.customerName,
    customer_age: saleData.customerAge,
    customer_contact: saleData.customerContact
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
    invoiceId: s.invoice_id,
    patientName: s.patient_name,
    diagnosis: s.diagnosis,
    customerName: s.customer_name,
    customerAge: s.customer_age,
    customerContact: s.customer_contact
  }));
};

export const clearSalesHistory = async (shopId: string) => {
  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('shop_id', shopId);

  if (error) throw new Error(error.message);
};

// --- Chat ---

export const getChatMessages = async (shopId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);

  return (data || []).map((m: any) => ({
    id: m.id,
    shopId: m.shop_id,
    userId: m.user_id,
    userName: m.user_name,
    content: m.content,
    imageUrl: m.image_url,
    createdAt: Number(m.created_at || 0),
    readBy: m.read_by || []
  }));
};

export const sendChatMessage = async (
  shopId: string, 
  userId: string, 
  userName: string, 
  content: string, 
  imageFile?: File
) => {
  let imageUrl = '';

  if (imageFile) {
    const fileExt = imageFile.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${shopId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(filePath, imageFile, { upsert: true });

    if (uploadError) {
      console.error("Upload Error:", uploadError);
      throw new Error(`Image upload failed: ${uploadError.message}. Check storage policies.`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(filePath);
    
    imageUrl = publicUrl;
  }

  const dbMessage = {
    shop_id: shopId,
    user_id: userId,
    user_name: userName,
    content: content,
    image_url: imageUrl,
    created_at: Date.now(),
    read_by: [userId] // Sender has read it
  };

  const { error } = await supabase.from('chat_messages').insert(dbMessage);
  if (error) throw new Error(error.message);
};

export const deleteChatMessage = async (messageId: string) => {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', messageId);

  if (error) throw new Error(error.message);
};

export const markMessagesAsRead = async (messageIds: string[], userId: string) => {
  if (messageIds.length === 0) return;
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, read_by')
    .in('id', messageIds);
    
  if (!messages) return;

  const updates = messages.map(async (msg: any) => {
    const currentReadBy = Array.isArray(msg.read_by) ? msg.read_by : [];
    if (!currentReadBy.includes(userId)) {
      await supabase
        .from('chat_messages')
        .update({ read_by: [...currentReadBy, userId] })
        .eq('id', msg.id);
    }
  });

  await Promise.all(updates);
};

export const subscribeToChat = (
  shopId: string, 
  callbacks: { 
    onInsert: (msg: Message) => void, 
    onDelete: (id: string) => void,
    onUpdate?: (msg: Message) => void
  }
) => {
  return supabase
    .channel('chat-room-' + shopId)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `shop_id=eq.${shopId}`
      },
      (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const m = payload.new;
          const message: Message = {
            id: m.id,
            shopId: m.shop_id,
            userId: m.user_id,
            userName: m.user_name,
            content: m.content,
            imageUrl: m.image_url,
            createdAt: Number(m.created_at),
            readBy: m.read_by || []
          };
          callbacks.onInsert(message);
        } else if (payload.eventType === 'DELETE') {
          callbacks.onDelete(payload.old.id);
        } else if (payload.eventType === 'UPDATE' && callbacks.onUpdate) {
           const m = payload.new;
           const message: Message = {
             id: m.id,
             shopId: m.shop_id,
             userId: m.user_id,
             userName: m.user_name,
             content: m.content,
             imageUrl: m.image_url,
             createdAt: Number(m.created_at),
             readBy: m.read_by || []
           };
           callbacks.onUpdate(message);
        }
      }
    )
    .subscribe();
};