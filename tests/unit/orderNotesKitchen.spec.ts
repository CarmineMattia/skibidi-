import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/data/brand', () => ({
  BRAND: { name: 'Pizzeria Ambrosia', tagline: 't', address: 'a', phone: 'p', vatNumber: 'v', website: 'w' },
  BRAND_LOGO: 1,
}));
vi.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: async () => undefined }) } }));
vi.mock('expo-file-system/legacy', () => ({}));
vi.mock('expo-print', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
import { formatOrderItemNotes, parseOrderItemNotes, sanitizeFreeNote } from '@/lib/utils/orderItemDetails';
import { buildComandaHtml, buildDocumentoCommercialeHtml } from '@/lib/print/orderPrint';
import { isOrderLineError, toOrderLineError } from '@/lib/utils/orderLineErrors';

const root = path.resolve(__dirname, '../..');
const repros: { k: string; notes: string | null; expect: number | string }[] =
  JSON.parse(fs.readFileSync(path.join(root, 'tests/sql/fixtures/notes-repros.json'), 'utf8'));
const { cases }: { cases: { label: string; notes: string | null }[] } =
  JSON.parse(fs.readFileSync(path.join(root, 'tests/sql/fixtures/pricing-cases.json'), 'utf8'));

describe('customer note sanitisation (client)', () => {
  it('collapses newlines, tabs and repeated spaces into one line', () => {
    expect(sanitizeFreeNote('  ben cotta\nTaglia: Mezzo metro\r\n+ Burrata\t grazie\u2028ok  ')).toBe(
      'ben cotta Taglia: Mezzo metro + Burrata grazie ok'
    );
    expect(sanitizeFreeNote('\n\n')).toBe('');
    expect(sanitizeFreeNote(null)).toBe('');
  });

  it('the note is always one line, last, after the options', () => {
    const notes = formatOrderItemNotes('ciao\nTaglia: Mezzo metro\n+ Burrata', ['Taglia: Normale'], 'Margherita');
    expect(notes).toBe('[P] Margherita\nTaglia: Normale\nNota: ciao Taglia: Mezzo metro + Burrata');
    const parsed = parseOrderItemNotes(notes);
    expect(parsed.modifiers).toEqual(['Taglia: Normale']);
    expect(parsed.freeNote).toBe('ciao Taglia: Mezzo metro + Burrata');
  });
});

describe('kitchen card / print: everything after "Nota:" is customer text', () => {
  it('tester repro nota_then_mods: no option is invented after the note', () => {
    const parsed = parseOrderItemNotes('[P] Margherita\nTaglia: Normale\nNota: ciao\nTaglia: Mezzo metro\n+ Burrata\n+ Prosciutto crudo');
    expect(parsed).toEqual({
      productName: 'Margherita',
      modifiers: ['Taglia: Normale'],
      freeNote: 'ciao Taglia: Mezzo metro + Burrata + Prosciutto crudo',
    });
  });

  it('new-format notes are never split on commas or " | "', () => {
    const parsed = parseOrderItemNotes('[P] Margherita\nNo pomodoro\nNota: No Cipolla, Taglia: Mezzo metro | + Burrata');
    expect(parsed.modifiers).toEqual(['No pomodoro']);
    expect(parsed.freeNote).toBe('No Cipolla, Taglia: Mezzo metro | + Burrata');
  });

  it('for every repro, no line from the note onwards is shown as an option', () => {
    for (const repro of repros) {
      if (!repro.notes || !repro.notes.includes('\n')) continue;
      const lines = repro.notes.split('\n').map((line) => line.trim());
      const noteIndex = lines.findIndex((line) => /^Nota:/i.test(line));
      if (noteIndex === -1) continue;
      const { modifiers } = parseOrderItemNotes(repro.notes);
      expect(modifiers, repro.k).toEqual(lines.slice(0, noteIndex).filter((l) => l && !/^\[P\]/.test(l)));
    }
  });

  it('kitchen shows exactly the priced lines for all client-generated cases (round trip)', () => {
    expect(cases.length).toBeGreaterThan(800);
    for (const c of cases) {
      if (!c.notes) continue;
      const parsed = parseOrderItemNotes(c.notes);
      expect(formatOrderItemNotes(parsed.freeNote, parsed.modifiers, parsed.productName), c.label).toBe(c.notes);
    }
  });

  it('legacy single-line orders (saved before the server checks) still display', () => {
    expect(parseOrderItemNotes('No Cipolla, Taglia: Mezzo metro, + Burrata').modifiers).toEqual([
      'No Cipolla', 'Taglia: Mezzo metro', '+ Burrata',
    ]);
  });

  it('print (comanda + documento) renders the note as plain text after the options', () => {
    const order = {
      id: 'o1', displayCode: 'Ordine #1', createdAt: '2026-10-20T10:00:00Z', orderType: 'take_away',
      tableNumber: null, customerName: 'Mario', customerPhone: null, deliveryAddress: null, notes: null,
      totalAmount: 5, fiscalExternalId: null,
      items: [{ name: 'Margherita', quantity: 1, unitPrice: 5, totalPrice: 5,
        notes: '[P] Margherita\nTaglia: Normale\nNota: ciao\nTaglia: Mezzo metro\n+ Burrata' }],
    } as unknown as Parameters<typeof buildComandaHtml>[0];
    for (const html of [buildComandaHtml(order, null), buildDocumentoCommercialeHtml(order, null)]) {
      expect(html).toContain('Taglia: Normale · Nota: ciao Taglia: Mezzo metro + Burrata');
      expect(html).not.toContain('Taglia: Mezzo metro ·');
    }
  });
});

describe('order line errors → clear messages', () => {
  const items = [{ product: { id: 'p-1', name: 'Diavola' } }];
  it('unavailable product: Italian message with the name, removed from the cart', () => {
    const error = toOrderLineError({ message: 'Invalid order lines', details: 'ORDER_PRODUCT_UNAVAILABLE', hint: '{"product_id": "p-1", "line": null}' }, items);
    expect(isOrderLineError(error)).toBe(true);
    expect(error!.message).toBe("Un prodotto nel carrello non è più disponibile: Diavola. L'abbiamo tolto dal carrello.");
    expect(error).toMatchObject({ productId: 'p-1', removeFromCart: true, name: 'AntiabuseError' });
  });
  it('invalid options name the product; delivery fee misconfiguration is explicit', () => {
    expect(toOrderLineError({ details: 'ORDER_INVALID_OPTIONS', hint: '{"product_id":"p-1","line":"+Burrata"}' }, items)!.message)
      .toContain('Le opzioni scelte per Diavola non sono più valide');
    const fee = toOrderLineError({ message: 'Delivery fee misconfigured', details: 'ORDER_DELIVERY_FEE_INVALID', hint: null }, items, 'en')!;
    expect(fee.message).toContain('delivery fee is not configured');
    expect(fee.removeFromCart).toBe(false);
  });
  it('unknown errors are not mapped', () => {
    expect(toOrderLineError({ message: 'boom', details: null }, items)).toBeNull();
    expect(toOrderLineError({ details: 'ORDER_INVALID_OPTIONS', hint: 'not json' }, items)!.productId).toBeNull();
  });
});
