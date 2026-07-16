/**
 * Stampa ordini — template Pizzeria Ambrosia (formato termico 80mm)
 *
 * - Documento commerciale: layout conforme allo schema Agenzia delle Entrate
 *   (DM 7/12/2016 e provv. RT). Finché l'emissione non passa dal Registratore
 *   Telematico viene stampato come copia di cortesia, con dicitura esplicita
 *   "non valido ai fini fiscali".
 * - Comanda cucina: ticket operativo senza prezzi unitari, font grandi.
 */

import { BRAND, BRAND_LOGO } from '@/lib/data/brand';
import { getOrderDisplayCode } from '@/lib/utils/orderDisplayCode';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Platform } from 'react-native';

export interface PrintOrderItem {
  name: string;
  quantity: number;
  unitPrice: number; // euro
  totalPrice: number; // euro
  notes?: string | null;
}

export interface PrintOrderData {
  id: string;
  displayCode?: string | null;
  createdAt: string;
  orderType?: string | null; // eat_in | take_away | delivery
  tableNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  totalAmount: number; // euro
  fiscalExternalId?: string | null;
  items: PrintOrderItem[];
}

const VAT_RATE = 22; // Allineato a useCreateOrder/cartToFiscalItems

let cachedLogoSrc: string | null = null;

async function getLogoSrc(): Promise<string | null> {
  if (cachedLogoSrc) return cachedLogoSrc;
  try {
    const asset = Asset.fromModule(BRAND_LOGO);
    if (!asset.downloaded) {
      await asset.downloadAsync();
    }
    if (Platform.OS === 'web') {
      cachedLogoSrc = asset.uri;
      return cachedLogoSrc;
    }
    const localUri = asset.localUri ?? asset.uri;
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    cachedLogoSrc = `data:image/png;base64,${base64}`;
    return cachedLogoSrc;
  } catch (error) {
    console.error('[orderPrint] Caricamento logo fallito:', error);
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatEuro(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/** Estrae l'orario di consegna/ritiro dal token tecnico [FULFILLMENT:iso] */
export function extractFulfillmentTime(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\[FULFILLMENT:([^\]]+)\]/);
  if (!match) return null;
  const date = new Date(match[1]);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** Etichetta pagamento in stile documento commerciale */
export function extractPaymentLabel(notes?: string | null): string {
  const normalized = (notes ?? '').toLowerCase();
  if (normalized.includes('pagamento: cash') || normalized.includes('pagamento: contant') || normalized.includes('metodo di pagamento: cash')) {
    return 'Pagamento contante';
  }
  if (normalized.includes('satispay')) {
    return 'Pagamento elettronico (Satispay)';
  }
  if (normalized.includes('stripe') || normalized.includes('terminal') || normalized.includes('card')) {
    return 'Pagamento elettronico';
  }
  return 'Pagamento contante';
}

/** Rimuove i token tecnici dalle note ordine per la stampa */
function cleanOrderNotes(notes?: string | null): string {
  if (!notes) return '';
  return notes
    .replace(/\[FULFILLMENT:[^\]]+\]/g, '')
    .replace(/Metodo di pagamento:\s*[^|]+/gi, '')
    .replace(/Delivery fee:\s*[^|]+/gi, '')
    .replace(/Fulfillment:\s*[^|]+/gi, '')
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' · ');
}

function orderTypeLabel(orderType?: string | null, tableNumber?: string | null): string {
  switch (orderType) {
    case 'eat_in':
      return tableNumber ? `TAVOLO ${tableNumber}` : 'AL TAVOLO';
    case 'take_away':
      return 'ASPORTO';
    case 'delivery':
      return 'DELIVERY';
    default:
      return '';
  }
}

const RECEIPT_BASE_STYLE = `
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: 72mm;
    margin: 0 auto;
    padding: 4mm 2mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .small { font-size: 9px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row .desc { flex: 1; }
  .logo { max-width: 48mm; max-height: 24mm; margin: 0 auto 4px; display: block; }
  h1 { font-size: 14px; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  td.qty { white-space: nowrap; padding-right: 4px; }
  td.amount { text-align: right; white-space: nowrap; }
  td.vat { text-align: right; white-space: nowrap; width: 28px; }
  .item-notes { font-size: 9px; padding-left: 10px; }
`;

function brandHeaderHtml(logoSrc: string | null): string {
  return `
    <div class="center">
      ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="${escapeHtml(BRAND.name)}" />` : ''}
      <h1 class="bold">${escapeHtml(BRAND.name.toUpperCase())}</h1>
      <div class="small">${escapeHtml(BRAND.tagline)}</div>
      <div class="small">${escapeHtml(BRAND.address)}</div>
      <div class="small">Tel. ${escapeHtml(BRAND.phone)}</div>
      <div class="small">${escapeHtml(BRAND.vatNumber)}</div>
    </div>
  `;
}

/**
 * Documento commerciale (copia di cortesia) — layout AdE:
 * descrizione/IVA/prezzo, totale complessivo con scorporo IVA,
 * modalità di pagamento, data/ora e numero documento.
 */
export function buildDocumentoCommercialeHtml(order: PrintOrderData, logoSrc: string | null): string {
  const createdAt = new Date(order.createdAt);
  const dateLabel = createdAt.toLocaleDateString('it-IT');
  const timeLabel = createdAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const docNumber = getOrderDisplayCode(order);
  const vatAmount = (order.totalAmount * VAT_RATE) / (100 + VAT_RATE);
  const paymentLabel = extractPaymentLabel(order.notes);

  const itemsHtml = order.items
    .map((item) => {
      const notesHtml = item.notes
        ? `<tr><td colspan="3" class="item-notes">${escapeHtml(item.notes)}</td></tr>`
        : '';
      return `
        <tr>
          <td class="desc">${item.quantity} x ${escapeHtml(item.name)}</td>
          <td class="vat">${VAT_RATE}%</td>
          <td class="amount">${formatEuro(item.totalPrice)}</td>
        </tr>
        ${notesHtml}
      `;
    })
    .join('');

  const fiscalFooter = order.fiscalExternalId
    ? `<div class="center small">Rif. scontrino RT: ${escapeHtml(order.fiscalExternalId)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8" /><style>${RECEIPT_BASE_STYLE}</style></head>
<body>
  ${brandHeaderHtml(logoSrc)}
  <div class="divider"></div>
  <div class="center bold">DOCUMENTO COMMERCIALE</div>
  <div class="center small">di vendita o prestazione</div>
  <div class="divider"></div>
  <table>
    <tr class="small">
      <td class="desc bold">DESCRIZIONE</td>
      <td class="vat bold">IVA</td>
      <td class="amount bold">EURO</td>
    </tr>
    ${itemsHtml}
  </table>
  <div class="divider"></div>
  <div class="row bold"><span>TOTALE COMPLESSIVO</span><span>€ ${formatEuro(order.totalAmount)}</span></div>
  <div class="row small"><span>di cui IVA (${VAT_RATE}%)</span><span>€ ${formatEuro(vatAmount)}</span></div>
  <div class="divider"></div>
  <div class="row"><span>${escapeHtml(paymentLabel)}</span><span>€ ${formatEuro(order.totalAmount)}</span></div>
  <div class="row"><span>Importo pagato</span><span>€ ${formatEuro(order.totalAmount)}</span></div>
  <div class="divider"></div>
  <div class="row small"><span>${dateLabel} ${timeLabel}</span><span>DOC. N. ${docNumber}</span></div>
  ${fiscalFooter}
  <div class="divider"></div>
  <div class="center bold small">*** COPIA DI CORTESIA ***</div>
  <div class="center bold small">NON VALIDO AI FINI FISCALI</div>
  <div class="center small">Il documento commerciale valido è emesso dal registratore telematico</div>
  <div class="divider"></div>
  <div class="center small">Grazie e arrivederci!</div>
  <div class="center small">${escapeHtml(BRAND.website.replace('https://', ''))}</div>
</body>
</html>`;
}

/** Comanda cucina: niente prezzi, font grandi, modifiche ed esigenze in evidenza. */
export function buildComandaHtml(order: PrintOrderData, logoSrc: string | null): string {
  const createdAt = new Date(order.createdAt);
  const timeLabel = createdAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const fulfillmentTime = extractFulfillmentTime(order.notes);
  const typeLabel = orderTypeLabel(order.orderType, order.tableNumber);
  const cleanedNotes = cleanOrderNotes(order.notes);

  const itemsHtml = order.items
    .map((item) => {
      const notesHtml = item.notes
        ? `<div class="comanda-notes">${escapeHtml(item.notes)}</div>`
        : '';
      return `
        <div class="comanda-item">
          <div class="comanda-line bold">${item.quantity}x ${escapeHtml(item.name.toUpperCase())}</div>
          ${notesHtml}
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8" /><style>
  ${RECEIPT_BASE_STYLE}
  body { font-size: 13px; }
  .comanda-item { margin: 6px 0; }
  .comanda-line { font-size: 15px; }
  .comanda-notes { font-size: 12px; padding-left: 12px; }
  .badge { font-size: 16px; font-weight: bold; }
</style></head>
<body>
  ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="${escapeHtml(BRAND.name)}" />` : `<div class="center bold">${escapeHtml(BRAND.name.toUpperCase())}</div>`}
  <div class="center bold">*** COMANDA CUCINA ***</div>
  <div class="divider"></div>
  <div class="row"><span class="bold">${escapeHtml(getOrderDisplayCode(order))}</span><span>ore ${timeLabel}</span></div>
  ${typeLabel ? `<div class="center badge">${escapeHtml(typeLabel)}</div>` : ''}
  ${fulfillmentTime ? `<div class="center bold">Per le ${fulfillmentTime}</div>` : ''}
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  ${cleanedNotes ? `<div class="bold">NOTE: ${escapeHtml(cleanedNotes)}</div>` : ''}
  ${order.customerName ? `<div>Cliente: ${escapeHtml(order.customerName)}${order.customerPhone ? ` (${escapeHtml(order.customerPhone)})` : ''}</div>` : ''}
  ${order.orderType === 'delivery' && order.deliveryAddress ? `<div>Consegna: ${escapeHtml(order.deliveryAddress)}</div>` : ''}
</body>
</html>`;
}

async function printHtml(html: string): Promise<void> {
  await Print.printAsync({ html });
}

/** Stampa il documento commerciale (copia di cortesia) di un ordine. */
export async function printDocumentoCommerciale(order: PrintOrderData): Promise<void> {
  const logoSrc = await getLogoSrc();
  await printHtml(buildDocumentoCommercialeHtml(order, logoSrc));
}

/** Stampa la comanda cucina di un ordine. */
export async function printComanda(order: PrintOrderData): Promise<void> {
  const logoSrc = await getLogoSrc();
  await printHtml(buildComandaHtml(order, logoSrc));
}
