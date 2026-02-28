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

// ============================================
// FISCAL TABLES (Italian Compliance)
// ============================================

export type FiscalAuditAction = 'emit' | 'void' | 'retry' | 'cancel';

export type FiscalAuditStatus = 'pending' | 'success' | 'error';

export type FiscalProvider = 'mock' | 'acube' | 'fatture-in-cloud' | 'epson';

export interface FiscalAuditLog {
  id: string;
  order_id: string;
  action: FiscalAuditAction;
  provider: FiscalProvider;
  external_id?: string;
  request_data: Record<string, unknown>;
  response_data?: Record<string, unknown>;
  status: FiscalAuditStatus;
  error_message?: string;
  error_code?: string;
  attempt_count: number;
  processing_time_ms?: number;
  created_at: string;
  updated_at: string;
}

export type RetryQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'manual';

export interface FiscalRetryQueue {
  id: string;
  order_id: string;
  provider: FiscalProvider;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string;
  last_error?: string;
  last_error_code?: string;
  status: RetryQueueStatus;
  created_at: string;
  updated_at: string;
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
      fiscal_audit_log: {
        Row: FiscalAuditLog;
        Insert: Omit<FiscalAuditLog, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FiscalAuditLog, 'id' | 'created_at' | 'updated_at'>>;
      };
      fiscal_retry_queue: {
        Row: FiscalRetryQueue;
        Insert: Omit<FiscalRetryQueue, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FiscalRetryQueue, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        args: { user_id: string };
        returns: boolean;
      };
      update_updated_at_column: {
        args: Record<string, never>;
        returns: unknown;
      };
      handle_new_user: {
        args: Record<string, never>;
        returns: unknown;
      };
      log_fiscal_event: {
        args: {
          p_order_id: string;
          p_action: string;
          p_provider: string;
          p_external_id?: string;
          p_request_data: Record<string, unknown>;
          p_response_data?: Record<string, unknown>;
          p_status: string;
          p_error_message?: string;
          p_error_code?: string;
          p_processing_time_ms?: number;
        };
        returns: string;
      };
      add_to_fiscal_retry_queue: {
        args: {
          p_order_id: string;
          p_provider?: string;
          p_error_message?: string;
          p_error_code?: string;
        };
        returns: string;
      };
      process_fiscal_retry_queue: {
        args: { p_batch_size?: number };
        returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      fiscal_status: FiscalStatus;
      order_status: OrderStatus;
    };
  };
}
