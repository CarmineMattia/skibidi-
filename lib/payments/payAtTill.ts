/**
 * v1 Skibidi Orders: pagamento SOLO alla cassa al ritiro.
 * Nessun pagamento online (Satispay/carta/PayPal rimossi dal flusso cliente).
 * Il metodo fiscale reale (contanti/carta) viene registrato dal POS della cassa;
 * qui salviamo 'cash' come segnaposto compatibile con i flussi fiscali/admin esistenti.
 */
export const PAY_AT_TILL_METHOD = 'cash' as const;
export const PAY_AT_TILL_NOTE = 'Metodo di pagamento: alla cassa';
export const PAY_AT_TILL_LABEL_IT = 'Paghi alla cassa al ritiro';
export const PAY_AT_TILL_LABEL_EN = 'Pay at the till when you pick up';
