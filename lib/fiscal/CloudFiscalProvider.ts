import type {
    FiscalOrderData,
    FiscalProviderResult,
    FiscalReceipt,
    IFiscalProvider,
    FiscalProviderType,
} from '@/types/fiscal.types';

/**
 * Configuration for Cloud Fiscal Provider
 */
interface CloudFiscalProviderConfig {
    apiKey: string;
    apiEndpoint: string;
    provider: FiscalProviderType;
    timeout?: number;
}

/**
 * Base Cloud Fiscal Provider for Italian fiscal APIs
 * Supports: A-Cube, FattureInCloud, Epson ePOS Cloud
 *
 * This is an abstract base - specific providers extend this with their
 * specific request/response formats.
 */
export abstract class CloudFiscalProvider implements IFiscalProvider {
    abstract readonly name: string;
    abstract readonly provider: FiscalProviderType;
    protected config: CloudFiscalProviderConfig;

    constructor(config: CloudFiscalProviderConfig) {
        this.config = {
            timeout: 30000,
            ...config,
        };
    }

    /**
     * Emit a fiscal receipt
     */
    async emitReceipt(data: FiscalOrderData): Promise<FiscalProviderResult> {
        try {
            const payload = this.formatReceiptPayload(data);
            const response = await this.apiRequest('/receipts', 'POST', payload);
            return this.parseReceiptResponse(response);
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Health check for the provider
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.apiRequest('/health', 'GET', undefined, 5000);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get receipt by external ID
     */
    async getReceipt(externalId: string): Promise<FiscalReceipt | null> {
        try {
            const response = await this.apiRequest(`/receipts/${externalId}`, 'GET');
            return this.parseGetReceiptResponse(response);
        } catch (error) {
            console.error('Failed to get receipt:', error);
            return null;
        }
    }

    /**
     * Void/Cancel a receipt (storno)
     */
    async voidReceipt(externalId: string): Promise<FiscalProviderResult> {
        try {
            const response = await this.apiRequest(`/receipts/${externalId}/void`, 'POST') as { receipt_number?: string };
            return {
                success: true,
                external_id: externalId,
                receipt_number: response.receipt_number,
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Format the receipt payload according to provider specification
     * Must be implemented by specific providers
     */
    protected abstract formatReceiptPayload(data: FiscalOrderData): unknown;

    /**
     * Parse the receipt response from provider
     * Must be implemented by specific providers
     */
    protected abstract parseReceiptResponse(response: any): FiscalProviderResult;

    /**
     * Parse the get receipt response
     * Must be implemented by specific providers
     */
    protected abstract parseGetReceiptResponse(response: any): FiscalReceipt | null;

    /**
     * Make an API request to the fiscal provider
     */
    protected async apiRequest<T>(
        path: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        body?: unknown,
        timeout?: number,
    ): Promise<T> {
        const url = `${this.config.apiEndpoint}${path}`;
        const requestTimeout = timeout || this.config.timeout;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'X-Provider': this.provider,
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new FiscalApiError(
                    errorData.message || response.statusText,
                    response.status,
                    errorData.code,
                    errorData,
                );
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Handle errors and return standardized result
     */
    protected handleError(error: unknown): FiscalProviderResult {
        if (error instanceof FiscalApiError) {
            return {
                success: false,
                error: error.message,
                error_code: error.code,
                raw_response: error.data,
            };
        }

        if (error instanceof Error) {
            return {
                success: false,
                error: error.message,
                error_code: 'UNKNOWN_ERROR',
            };
        }

        return {
            success: false,
            error: 'Unknown error occurred',
            error_code: 'UNKNOWN_ERROR',
        };
    }

    /**
     * Convert EUR price to cents
     */
    protected eurosToCents(euros: number): number {
        return Math.round(euros * 100);
    }

    /**
     * Convert cents to EUR
     */
    protected centsToEuros(cents: number): number {
        return cents / 100;
    }
}

/**
 * A-Cube Fiscal Provider Implementation
 * https://www.acube.it/
 */
export class AcubeFiscalProvider extends CloudFiscalProvider {
    readonly name = 'A-Cube';
    readonly provider: FiscalProviderType = 'acube';

    constructor(config: CloudFiscalProviderConfig) {
        super({ ...config, provider: 'acube' });
    }

    protected formatReceiptPayload(data: FiscalOrderData): unknown {
        return {
            type: 'receipt',
            timestamp: data.timestamp,
            payment_method: this.mapPaymentMethod(data.payment_method),
            customer: data.customer_name ? {
                name: data.customer_name,
            } : undefined,
            items: data.items.map(item => ({
                code: item.product_id,
                description: item.name,
                quantity: item.quantity,
                unit_price: this.centsToEuros(item.unit_price),
                vat_rate: item.vat_rate,
            })),
            totals: {
                amount: this.centsToEuros(data.total_amount),
                vat: this.centsToEuros(data.total_vat),
            },
        };
    }

    protected parseReceiptResponse(response: any): FiscalProviderResult {
        if (response.success) {
            return {
                success: true,
                external_id: response.external_id || response.receipt_id,
                receipt_number: response.receipt_number,
                pdf_url: response.pdf_url,
            };
        }

        return {
            success: false,
            error: response.error || 'Failed to emit receipt',
            error_code: response.error_code,
            raw_response: response,
        };
    }

    protected parseGetReceiptResponse(response: any): FiscalReceipt | null {
        if (!response || response.error) {
            return null;
        }

        return {
            id: response.id || crypto.randomUUID(),
            order_id: response.order_id,
            external_id: response.external_id,
            receipt_number: response.receipt_number,
            pdf_url: response.pdf_url,
            xml_data: response.xml_data,
            created_at: response.created_at || new Date().toISOString(),
        };
    }

    private mapPaymentMethod(method: string): string {
        const map: Record<string, string> = {
            cash: '01', // Contanti
            card: '02', // Carta di credito/debito
            digital: '03', // Pagamento digitale
        };
        return map[method] || '01';
    }
}

/**
 * FattureInCloud Fiscal Provider Implementation
 * https://www.fattureincloud.it/
 */
export class FattureInCloudProvider extends CloudFiscalProvider {
    readonly name = 'FattureInCloud';
    readonly provider: FiscalProviderType = 'fatture-in-cloud';

    constructor(config: CloudFiscalProviderConfig) {
        super({ ...config, provider: 'fatture-in-cloud' });
    }

    protected formatReceiptPayload(data: FiscalOrderData): unknown {
        return {
            document_type: 'receipt',
            data: {
                id_ordine: data.order_id,
                data_documento: data.timestamp,
                tipo_pagamento: this.mapPaymentMethod(data.payment_method),
                oggetto: data.customer_name || 'Scontrino POS',
                dettaglio_linee: data.items.map(item => ({
                    descrizione: item.name,
                    quantita: item.quantity,
                    prezzo_unitario: this.centsToEuros(item.unit_price),
                    aliquota_iva: item.vat_rate,
                })),
                importo_totale: this.centsToEuros(data.total_amount),
                importo_iva: this.centsToEuros(data.total_vat),
            },
        };
    }

    protected parseReceiptResponse(response: any): FiscalProviderResult {
        const data = response.data || response;
        if (response.success || data.id_documento) {
            return {
                success: true,
                external_id: data.id_documento,
                receipt_number: data.numero_documento,
                pdf_url: data.url_pdf,
            };
        }

        return {
            success: false,
            error: response.error?.message || 'Failed to emit receipt',
            error_code: response.error?.code,
            raw_response: response,
        };
    }

    protected parseGetReceiptResponse(response: any): FiscalReceipt | null {
        const data = response.data || response;
        if (!data || !data.id_documento) {
            return null;
        }

        return {
            id: data.id_documento,
            order_id: data.id_ordine,
            external_id: data.id_documento,
            receipt_number: data.numero_documento,
            pdf_url: data.url_pdf,
            xml_data: data.xml_data,
            created_at: data.data_creazione || new Date().toISOString(),
        };
    }

    private mapPaymentMethod(method: string): string {
        const map: Record<string, string> = {
            cash: 'contanti',
            card: 'bancomat',
            digital: 'altro',
        };
        return map[method] || 'contanti';
    }
}

/**
 * Custom error class for fiscal API errors
 */
export class FiscalApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public code: string,
        public data: any = null,
    ) {
        super(message);
        this.name = 'FiscalApiError';
    }
}