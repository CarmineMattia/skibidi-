type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type AdminOrderRealtimeNoticeTone = 'info' | 'success' | 'warning' | 'error';

export type AdminOrderRealtimeNotice = {
  title: string;
  message: string;
  tone: AdminOrderRealtimeNoticeTone;
};

export function buildAdminOrderRealtimeNotice(input: {
  previousStatus?: string | null;
  nextStatus?: string | null;
  orderCode: string;
}): AdminOrderRealtimeNotice | null {
  const previousStatus = input.previousStatus as OrderStatus | null | undefined;
  const nextStatus = input.nextStatus as OrderStatus | null | undefined;

  if (!nextStatus || nextStatus === previousStatus) {
    return null;
  }

  if (nextStatus === 'pending') {
    return {
      title: 'Nuovo ordine in arrivo',
      message: `${input.orderCode} è in attesa di conferma in cucina.`,
      tone: 'warning',
    };
  }

  if (nextStatus === 'preparing') {
    return {
      title: 'Ordine preso in carico',
      message: `${input.orderCode} è passato in preparazione.`,
      tone: 'info',
    };
  }

  if (nextStatus === 'ready') {
    return {
      title: 'Ordine pronto',
      message: `${input.orderCode} è pronto per consegna/ritiro.`,
      tone: 'success',
    };
  }

  if (nextStatus === 'delivered') {
    return {
      title: 'Ordine completato',
      message: `${input.orderCode} è stato completato.`,
      tone: 'success',
    };
  }

  if (nextStatus === 'cancelled') {
    return {
      title: 'Ordine rifiutato',
      message: `${input.orderCode} è stato rifiutato.`,
      tone: 'error',
    };
  }

  return null;
}
