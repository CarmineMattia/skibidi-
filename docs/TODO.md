# TODO — Skibidi Orders (Ambrosia)

Riferimento: [piano](./SKIBIDI-ORDERS-PLAN.md). Stato del codice verificato con grep il 2026-10-13.

## POS / integrazione
- [ ] Chiedere al proprietario nome del gestionale/POS
- [ ] Ottenere contatto del fornitore; chiedere API o import file
- [ ] Verificare edizione Windows 10 e permessi della cassa
- [ ] Scegliere integrazione (API > import file > fornitore > Rakijazios GUI)
- [ ] Fase temporanea: dashboard ordini su Chrome alla cassa

## Auth (gap tra decisioni e codice)
- [ ] Aggiungere login Google (`signInWithOAuth` assente nel codice)
- [ ] Rimuovere email+password / signup (`signInWithPassword`, `signUp` in `lib/stores/AuthContext.tsx`, `app/login.tsx`)
- [ ] Decidere su OTP email (`signInWithOtp` in `AuthContext.tsx`): non previsto dalle decisioni
- [ ] Rimuovere flusso guest (riferimenti in `app/login.tsx`, `app/_layout.tsx`, `app/(tabs)/*`, `app/modal.tsx`, `lib/hooks/useCreateOrder.ts`, `lib/hooks/useOrders.ts`, `HomeGuestHero.tsx`)

## Pagamenti
- [ ] Nascondere/rimuovere UI Satispay e carta/Stripe (`components/features/PaymentSelection.tsx`, `SatispayOpenHint.tsx`, `lib/hooks/usePayment.ts`, `useRealPayment.ts`, `app/one-screen-checkout.tsx`, `app/modal.tsx`): v1 = solo pagamento alla cassa

## Stati ordine
- [ ] Allineare enum: oggi `pending, confirmed, preparing, ready, delivered, completed, cancelled`; servono "ritirato e pagato" e "rifiutato" distinti
- [ ] Bloccare passaggio a `preparing` senza accettazione manuale (vincolo lato DB/server)

## Antiabuso (nulla implementato lato server)
- [ ] Limite ordini aperti per account
- [ ] Rate limit server sugli ordini (oggi solo gestione del rate limit email di Supabase in `app/login.tsx`)
- [ ] Turnstile (assente)
- [ ] Valore massimo dell'ordine
- [ ] Blocco account
- [ ] Storico mancati ritiri

## Bug noti
- [ ] Ordini creati senza `order_items`: Marinara #1 e Gamberi #2 (2026-09-25) avevano 0 righe. Verificare che l'invio atomico (`20261008_atomic_order_submission.sql`) copra tutti i percorsi e pulire gli ordini fantasma
- [ ] `order_daily_counters` con RLS disattivata (esposta all'anon key): abilitare RLS

## Rimandato
- Bot WhatsApp
