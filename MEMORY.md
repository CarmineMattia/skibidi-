# Memoria Progetto Skibidi POS - OpenClaw

## Stato Attuale (aggiornato 2026-02-14)

### Core Flow
- login → menu → carrello → ordine → success
- TypeScript: errori risolti (0)
- Auth: Supabase con ruoli (admin, customer, kiosk)
- Fiscal: integrazione base con CloudFiscalProvider

### Bug Noti
- [vuota - da popolare durante heartbeat]

### Decisioni Prese
- Focus boomer UX: pulsanti grandi, feedback immediato
- Supabase per auth + database
- Expo Router per navigazione
- NativeWind per styling

### Problemi Aperti
- Deploy: serve config EAS/Netlify reale
- Test: assenti, simulazione boomer in corso
- Payment: non integrato (SumUp/Nexi)

### Progressi Chiave
- 2026-02-14: Fix 14 errori TypeScript (syntax error, icon name, duplicate export, type mismatch)
- 2026-02-14: Aggiunto Toast component per feedback immediato (boomer UX)
- 2026-02-14: Aggiunto dialogo conferma logout per prevenire click accidentali

### Ultimi 3 Cicli Completati
1. **Ciclo 1:** Fix 14 errori TypeScript → branch `fix/boomer-ts-errors-20260214`
2. **Ciclo 2:** Toast feedback su add-to-cart → branch `fix/boomer-ts-errors-20260214`  
3. **Ciclo 3:** Logout confirmation dialog → branch `usability/boomer-logout-confirm`
- 2026-02-13: Fix 14 errori TypeScript
- 2026-02-13: Setup cron boomer-tests ogni ora

---

## Roadmap Evoluta

### Fase 1 (completata)
- [x] Core app struttura
- [x] Auth base
- [x] Menu + carrello
- [x] Kitchen dashboard
- [x] TypeScript fix

### Fase 2 (in corso)
- [ ] Auth completa + edge cases
- [ ] Test coverage
- [ ] Deploy config
- [ ] Boomer UX improvements

### Fase 3 (futuro)
- [ ] Payment integration (SumUp/Nexi)
- [ ] Fiscal RT (stampante)
- [ ] Multi-language
- [ ] PWA mode

---

## Insights & Note
- Utenti boomer: pulsanti grandi, feedback immediato, no step nascosti
- Priorità: stabilità flusso ordine > feature nuove
- Trend check competitor: SumUp dominate Italy, kiosk niche underserved
