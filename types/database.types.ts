/**
 * Database Types
 * Definizioni TypeScript per il database Supabase
 */

// Re-export generated types
export * from './database.types.generated';

// Legacy aliases for convenience
export type UserRole = 'admin' | 'customer' | 'kiosk';

export type FiscalStatus = 'pending' | 'success' | 'error';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface Profile {
  id: string;
  role: UserRole;
  email?: string;
  full_name?: string;
  created_at: string;
  updated_at: string;
  phone?: string;
  address?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  ingredients?: string[];
}

export interface Order {
  id: string;
  customer_id?: string;
  status: OrderStatus;
  total_amount: number;
  fiscal_status: FiscalStatus;
  fiscal_external_id?: string;
  pdf_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  order_type?: 'eat_in' | 'take_away' | 'delivery';
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  table_number?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
}

// Helper types for joins
export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface OrderItemWithProduct extends OrderItem {
  product: Product;
}

// Supabase Database type definition
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Category, 'id' | 'created_at' | 'updated_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Order, 'id' | 'created_at' | 'updated_at'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at'>;
        Update: Partial<Omit<OrderItem, 'id' | 'created_at'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      fiscal_status: FiscalStatus;
      order_status: OrderStatus;
    };
  };
}
