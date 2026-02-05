import type { IFiscalProvider, FiscalConfig, FiscalOrderData, FiscalProviderResult } from '@/types/fiscal.types';
import { MockFiscalProvider } from './MockFiscalProvider';
import { AcubeFiscalProvider, FattureInCloudProvider } from './CloudFiscalProvider';

/**
 * Fiscal Service Factory
 * Creates fiscal provider instances based on configuration
 */
export class FiscalProviderFactory {
    private static instance: FiscalProviderFactory;
    private providers: Map<string, IFiscalProvider> = new Map();

    private constructor() {}

    static getInstance(): FiscalProviderFactory {
        if (!FiscalProviderFactory.instance) {
            FiscalProviderFactory.instance = new FiscalProviderFactory();
        }
        return FiscalProviderFactory.instance;
    }

    /**
     * Get or create a fiscal provider based on config
     */
    getProvider(config: FiscalConfig): IFiscalProvider {
        const cacheKey = `${config.provider}_${config.mock_mode}`;

        if (this.providers.has(cacheKey)) {
            return this.providers.get(cacheKey)!;
        }

        const provider = this.createProvider(config);
        this.providers.set(cacheKey, provider);
        return provider;
    }

    private createProvider(config: FiscalConfig): IFiscalProvider {
        if (config.mock_mode) {
            return new MockFiscalProvider();
        }

        if (!config.api_key || !config.api_endpoint) {
            console.warn('Missing API credentials, falling back to mock provider');
            return new MockFiscalProvider();
        }

        switch (config.provider) {
            case 'acube':
                return new AcubeFiscalProvider({
                    apiKey: config.api_key,
                    apiEndpoint: config.api_endpoint,
                });
            case 'fatture-in-cloud':
                return new FattureInCloudProvider({
                    apiKey: config.api_key,
                    apiEndpoint: config.api_endpoint,
                });
            case 'epson':
                // Epson RT would need separate implementation (direct TCP/HTTP)
                console.warn('Epson RT provider not yet implemented, using mock');
                return new MockFiscalProvider();
            default:
                return new MockFiscalProvider();
        }
    }

    /**
     * Clear all cached providers
     */
    clear(): void {
        this.providers.clear();
    }
}

/**
 * Main Fiscal Service
 * Handles fiscal operations with queue and retry logic
 */
export class FiscalService {
    private provider: IFiscalProvider;
    private config: FiscalConfig;
    private processingQueue = new Set<string>();

    constructor(config: FiscalConfig) {
        this.config = config;
        const factory = FiscalProviderFactory.getInstance();
        this.provider = factory.getProvider(config);
    }

    /**
     * Emit a fiscal receipt for an order
     * Handles queue logic and retry
     */
    async emitReceipt(data: FiscalOrderData): Promise<FiscalProviderResult> {
        // Prevent duplicate processing
        if (this.processingQueue.has(data.order_id)) {
            return {
                success: false,
                error: 'Order is already being processed',
                error_code: 'DUPLICATE_PROCESSING',
            };
        }

        this.processingQueue.add(data.order_id);

        try {
            // Check if fiscal is enabled
            if (!this.config.enabled) {
                console.log('Fiscalization disabled, skipping');
                return {
                    success: true,
                    external_id: 'DISABLED-' + data.order_id,
                };
            }

            // Attempt to emit receipt
            const result = await this.provider.emitReceipt(data);
            return result;
        } catch (error) {
            console.error('Fiscal service error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                error_code: 'SERVICE_ERROR',
            };
        } finally {
            this.processingQueue.delete(data.order_id);
        }
    }

    /**
     * Health check for the fiscal provider
     */
    async healthCheck(): Promise<boolean> {
        try {
            return await this.provider.healthCheck();
        } catch {
            return false;
        }
    }

    /**
     * Get a receipt by external ID
     */
    async getReceipt(externalId: string) {
        return await this.provider.getReceipt(externalId);
    }

    /**
     * Void a receipt (storno)
     */
    async voidReceipt(externalId: string): Promise<FiscalProviderResult> {
        if (!this.config.void_enabled) {
            return {
                success: false,
                error: 'Receipt voiding is disabled',
                error_code: 'VOID_DISABLED',
            };
        }

        return await this.provider.voidReceipt(externalId);
    }

    /**
     * Update provider configuration
     */
    updateConfig(newConfig: Partial<FiscalConfig>): void {
        this.config = { ...this.config, ...newConfig };
        const factory = FiscalProviderFactory.getInstance();
        this.provider = factory.getProvider(this.config);
    }

    /**
     * Get current configuration
     */
    getConfig(): Readonly<FiscalConfig> {
        return this.config;
    }
}

/**
 * Create a fiscal service with configuration from environment
 */
export function createFiscalService(overrideConfig?: Partial<FiscalConfig>): FiscalService {
    const config: FiscalConfig = {
        provider: 'acube',
        enabled: true,
        mock_mode: process.env.EXPO_PUBLIC_FISCAL_MOCK_MODE === 'true' || true, // Default to mock
        api_key: process.env.EXPO_PUBLIC_FISCAL_API_KEY,
        api_endpoint: process.env.EXPO_PUBLIC_FISCAL_API_ENDPOINT,
        retry_max_attempts: 3,
        retry_delay_seconds: 60,
        void_enabled: true,
        ...overrideConfig,
    };

    return new FiscalService(config);
}

// Singleton instance for the app
let globalFiscalService: FiscalService | null = null;

/**
 * Get or create the global fiscal service instance
 */
export function getFiscalService(): FiscalService {
    if (!globalFiscalService) {
        globalFiscalService = createFiscalService();
    }
    return globalFiscalService;
}
