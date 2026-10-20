type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'rejected'
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

  if (nextStatus === 'accepted') {
    return {
      title: 'Ordine accettato',
      message: `${input.orderCode} è stato accettato. Avvia la preparazione in cucina.`,
      tone: 'info',
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
      title: 'Ritirato e pagato',
      message: `${input.orderCode} è stato ritirato e pagato.`,
      tone: 'success',
    };
  }

  if (nextStatus === 'rejected') {
    return {
      title: 'Ordine rifiutato',
      message: `${input.orderCode} è stato rifiutato.`,
      tone: 'error',
    };
  }

  if (nextStatus === 'cancelled') {
    return {
      title: 'Ordine annullato',
      message: `${input.orderCode} è stato annullato.`,
      tone: 'error',
    };
  }

  return null;
}
