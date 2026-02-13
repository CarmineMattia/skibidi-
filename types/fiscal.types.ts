/**
 * Fiscal types for Italian POS system
 * Supports legal fiscalization requirements
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Fiscal status of an order
 * - pending: Order created but not yet fiscalized
 * - success: Successfully fiscalized
 * - error: Fiscalization failed, queued for retry
 * Note: Re-exported from database.types to avoid duplication
 */
// FiscalStatus is now exported from database.types.ts

/**
 * Payment method for fiscal receipt
 */
export type PaymentMethod = 'cash' | 'card' | 'digital';

/**
 * Supported fiscal providers
 */
export type FiscalProviderType = 'acube' | 'fatture-in-cloud' | 'epson';

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/**
 * Order item for fiscal receipt
 */
export interface FiscalOrderItem {
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number; // in cents (e.g., 850 = €8.50)
    total_price: number; // in cents
    vat_rate: number; // 22%, 10%, 4% (as number, e.g., 22)
    category?: string;
}

/**
 * Order data sent to fiscal provider
 */
export interface FiscalOrderData {
    order_id: string;
    customer_name?: string;
    items: FiscalOrderItem[];
    total_amount: number; // in cents
    total_vat: number; // in cents
    payment_method: PaymentMethod;
    timestamp: string; // ISO 8601
}

/**
 * Result from fiscal provider operation
 */
export interface FiscalProviderResult {
    success: boolean;
    external_id?: string;
    receipt_number?: string;
    pdf_url?: string;
    error?: string;
    error_code?: string;
    raw_response?: any;
}

/**
 * Stored fiscal receipt record
 */
export interface FiscalReceipt {
    id: string;
    order_id: string;
    external_id: string;
    receipt_number?: string;
    pdf_url?: string;
    xml_data?: string;
    created_at: string;
}

/**
 * Queued fiscal operation for retry
 */
export interface FiscalQueueItem {
    id: string;
    order_id: string;
    order_data: FiscalOrderData;
    attempts: number;
    last_attempt_at: string;
    next_attempt_at: string;
    error_message?: string;
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

/**
 * Fiscal provider interface (Adapter Pattern)
 * All fiscal providers must implement this interface
 */
export interface IFiscalProvider {
    /**
     * Provider name for identification
     */
    readonly name: string;

    /**
     * Emit a fiscal receipt for an order
     * This is the main operation for legal fiscalization
     */
    emitReceipt(data: FiscalOrderData): Promise<FiscalProviderResult>;

    /**
     * Check if the provider is available (health check)
     */
    healthCheck(): Promise<boolean>;

    /**
     * Get a receipt by external ID
     */
    getReceipt(externalId: string): Promise<FiscalReceipt | null>;

    /**
     * Cancel/void a receipt (storno)
     * Required by Italian law for corrections
     */
    voidReceipt(externalId: string): Promise<FiscalProviderResult>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Fiscal system configuration
 */
export interface FiscalConfig {
    provider: FiscalProviderType;
    enabled: boolean;
    mock_mode: boolean; // If true, use mock provider for testing
    api_key?: string;
    api_endpoint?: string;
    retry_max_attempts: number;
    retry_delay_seconds: number;
    void_enabled: boolean;
}
