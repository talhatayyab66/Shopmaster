export enum UserRole {
  ADMIN = 'ADMIN',
  SALES = 'SALES'
}

export interface Shop {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
}

export interface User {
  id: string;
  username: string;
  email?: string; // Optional for sales staff
  role: UserRole;
  shopId: string;
  passwordHash: string; // In a real app, never store plain text. Here we simulate.
  fullName: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStockLevel: number;
  sku?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  priceAtSale: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  shopId: string;
  sellerId: string; // User ID who made the sale
  sellerName: string;
  items: SaleItem[];
  totalAmount: number;
  timestamp: number;
  invoiceId: string;
}

export type ViewState = 'dashboard' | 'inventory' | 'pos' | 'staff' | 'settings' | 'ai-assistant';
