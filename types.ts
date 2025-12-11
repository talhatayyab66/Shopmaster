
export enum UserRole {
  ADMIN = 'ADMIN',
  SALES = 'SALES'
}

export type BusinessType = 'SHOP' | 'CLINIC' | 'PHARMACY' | 'RESTAURANT';

export interface Shop {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  address?: string;
  currency?: string;
  logoUrl?: string;
  businessType: BusinessType;
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
  // Pharmacy/Clinic specific
  formula?: string; // Generic Name
  brand?: string;
}

export interface CartItem extends Product {
  quantity: number;
  discount?: number; // Percentage discount (0-100)
  isService?: boolean; // For fees/charges that don't track stock
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
  
  // Specific Fields
  patientName?: string;
  diagnosis?: string;
  customerName?: string;
  customerAge?: string;
  customerContact?: string;
}

export interface Message {
  id: string;
  shopId: string;
  userId: string;
  userName: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
  readBy: string[]; // Array of User IDs who have read the message
}

export type ViewState = 'dashboard' | 'inventory' | 'pos' | 'orders' | 'staff' | 'settings' | 'ai-assistant' | 'chat';