import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { orderQuestionNumber, orderWhatsAppPrefill, orderWhatsAppUrl } from '../../lib/utils/orderWhatsApp';

const root = path.resolve(__dirname, '../..');

describe('WhatsApp sull’ordine', () => {
  it('usa lo stesso numero del CTA in home e precompila il numero ordine', () => {
    const brand = fs.readFileSync(path.join(root, 'lib/data/brand.ts'), 'utf8');
    const hero = fs.readFileSync(path.join(root, 'components/features/landing/LandingHero.tsx'), 'utf8');
    expect(brand).toContain("whatsapp: '3905221717681'");
    expect(hero).toContain('https://wa.me/${BRAND.whatsapp}');
    const url = orderWhatsAppUrl('3905221717681', orderQuestionNumber('Ordine #12'));
    expect(url).toBe(`https://wa.me/3905221717681?text=${encodeURIComponent('Ciao, ho una domanda sull\'ordine #12')}`);
    expect(orderWhatsAppPrefill('12')).toBe('Ciao, ho una domanda sull\'ordine #12');
  });

  it('tiene solo le cifre del numero e non mette un # vuoto', () => {
    expect(orderWhatsAppUrl('+39 0522 171 7681', '4')).toMatch(/^https:\/\/wa\.me\/3905221717681\?text=/);
    expect(orderWhatsAppUrl('abc', '4')).toBeNull();
    expect(orderWhatsAppPrefill('')).toBe('Ciao, ho una domanda sull\'ordine');
    expect(orderQuestionNumber('Ordine #7')).toBe('7');
    expect(orderQuestionNumber('Patate #3')).toBe('3');
  });

  it('sostituisce Chat con WhatsApp, accanto a Chiama e con la stessa classe', () => {
    const page = fs.readFileSync(path.join(root, 'app/(tabs)/order-tracking.tsx'), 'utf8');
    const actions = fs.readFileSync(path.join(root, 'components/features/orders/OrderTrackingContactActions.tsx'), 'utf8');
    expect(page).not.toMatch(/>Chat</);
    expect(page).not.toMatch(/Chatta/);
    expect(page).toContain('OrderTrackingContactActions');
    expect(actions).toContain('>Chiama<');
    expect(actions).toContain('>WhatsApp<');
    expect(actions).toContain('accessibilityLabel={`Chiama ${BRAND.phone}`}');
    expect(actions).toContain('accessibilityLabel={whatsappLabel}');
    expect(actions.match(/className=\{ORDER_CONTACT_BUTTON_CLASS\}/g)?.length).toBe(2);
    expect(actions).toContain('flex-1 h-11 rounded-xl bg-[#8d171e]');
    expect(actions).toContain('orderWhatsAppUrl(BRAND.whatsapp, orderNumber)');
  });
});
