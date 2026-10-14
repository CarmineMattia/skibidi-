# TODO — Skibidi Orders (Ambrosia)

Riferimento: [piano](./SKIBIDI-ORDERS-PLAN.md). Stato aggiornato il 2026-10-14 (main @ `0add321`).

## POS / integrazione
- [ ] Chiedere al proprietario nome del gestionale/POS
- [ ] Ottenere contatto del fornitore; chiedere API o import file
- [ ] Verificare edizione Windows 10 e permessi della cassa
- [ ] Scegliere integrazione (API > import file > fornitore > Rakijazios GUI)
- [ ] Fase temporanea: dashboard ordini su Chrome alla cassa

## Stato PR (2026-10-14)

### Unite su main
- [x] #16 fix errori TypeScript `LandingHero.tsx`
- [x] #11 invio ordine atomico (`create_order_with_items`) + foto pizze
- [x] #12 documentazione decisioni (piano, todo, README)
- [x] #13 "Usa posizione" e tipografia più leggibile
- [x] #14 RLS su `order_daily_counters`
- [x] #15 immagini Unsplash morte sostituite
- [x] #19 checkout solo pagamento alla cassa (via Satispay, carta, PayPal)
- [x] #21 upsell bevande: primo tap non perso, "Continua senza"

### In attesa
- [ ] #17 login solo Google: attivare prima il provider Google su Supabase (oggi google=false, email=true)
- [ ] #18 approvazione manuale con nuovi stati: migration da applicare live solo con OK di Carmine
- [ ] #20 antiabuso: migration da applicare live solo con OK di Carmine; richiede #17 attivo. Se combinata con #18 tenere la versione di #20 di `tests/sql/atomic-order-submission.sql`
- [ ] #11: registrare la migration `20261008_atomic_order_submission.sql` su prod (`migration repair`, funzioni già presenti live)

## Da decidere / aperti
- [ ] Bottone admin "non ritirato" (mancato ritiro) nella dashboard
- [ ] Edge function Stripe: tenere per la v2 o cancellare
- [ ] Chi può annullare un ordine dopo l'accettazione (solo admin o anche cliente)
- [ ] Confermare i limiti antiabuso (€150, 2 ordini aperti, 3 ogni 10 min, blocco dopo 3 mancati ritiri)
- [ ] Errore React #418 (hydration) a ogni caricamento, presente anche in prod
- [ ] 16 vecchi ordini senza `order_items` su prod (12/06–25/09: 7 consegnati, 9 annullati): decidere se pulire

## Rimandato
- Bot WhatsApp
