import type {
    FiscalOrderData,
    FiscalProviderResult,
    FiscalReceipt,
    IFiscalProvider,
} from '@/types/fiscal.types';

/**
 * Mock Fiscal Provider for testing and development
 * Simulates fiscal API behavior without actual network calls
 */
export class MockFiscalProvider implements IFiscalProvider {
    readonly name = 'MockFiscalProvider';

    private receiptCounter = 1000;
    private receipts = new Map<string, FiscalReceipt>();

    async emitReceipt(data: FiscalOrderData): Promise<FiscalProviderResult> {
        // Simulate network delay (500-2000ms)
        await this.delay(Math.random() * 1500 + 500);

        // Simulate 10% failure rate for testing
        if (Math.random() < 0.1) {
            return {
                success: false,
                error: 'Simulated API error: Service temporarily unavailable',
                error_code: 'SERVICE_UNAVAILABLE',
            };
        }

        // Generate mock receipt
        const receiptNumber = (this.receiptCounter++).toString();
        const externalId = `MOCK-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const receipt: FiscalReceipt = {
            id: crypto.randomUUID(),
            order_id: data.order_id,
            external_id: externalId,
            receipt_number: receiptNumber,
            pdf_url: `https://example.com/receipts/${externalId}.pdf`,
            xml_data: this.generateMockXml(data, externalId, receiptNumber),
            created_at: new Date().toISOString(),
        };

        this.receipts.set(externalId, receipt);

        return {
            success: true,
            external_id: externalId,
            receipt_number: receiptNumber,
            pdf_url: receipt.pdf_url,
        };
    }

    async healthCheck(): Promise<boolean> {
        await this.delay(200);
        return Math.random() > 0.05; // 5% failure rate
    }

    async getReceipt(externalId: string): Promise<FiscalReceipt | null> {
        await this.delay(300);
        return this.receipts.get(externalId) || null;
    }

    async voidReceipt(externalId: string): Promise<FiscalProviderResult> {
        const receipt = this.receipts.get(externalId);
        await this.delay(500);

        if (!receipt) {
            return {
                success: false,
                error: 'Receipt not found',
                error_code: 'NOT_FOUND',
            };
        }

        this.receipts.delete(externalId);
        return {
            success: true,
            external_id: externalId,
            receipt_number: receipt.receipt_number,
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private generateMockXml(
        data: FiscalOrderData,
        externalId: string,
        receiptNumber: string,
    ): string {
        const lines = data.items.map(item => {
            const vat = (item.total_price * item.vat_rate) / (100 + item.vat_rate);
            const net = item.total_price - vat;
            return `    <Line>
        <Description>${this.escapeXml(item.name)}</Description>
        <Quantity>${item.quantity}</Quantity>
        <UnitPrice>${(item.unit_price / 100).toFixed(2)}</UnitPrice>
        <NetAmount>${(net / 100).toFixed(2)}</NetAmount>
        <VatAmount>${(vat / 100).toFixed(2)}</VatAmount>
        <VatRate>${item.vat_rate}</VatRate>
      </Line>`;
        }).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<FiscalReceipt xmlns="http://www.fiscal.it/schema/receipt">
  <Header>
    <ReceiptNumber>${receiptNumber}</ReceiptNumber>
    <ExternalId>${externalId}</ExternalId>
    <DateTime>${data.timestamp}</DateTime>
    <PaymentMethod>${data.payment_method}</PaymentMethod>
  </Header>
  <Items>
${lines}
  </Items>
  <Totals>
    <TotalAmount>${(data.total_amount / 100).toFixed(2)}</TotalAmount>
    <TotalVat>${(data.total_vat / 100).toFixed(2)}</TotalVat>
  </Totals>
</FiscalReceipt>`;
    }

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
