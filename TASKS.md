# TASKS.md - Skibidi POS

## Legenda
- [ ] aperta
- [in-progress] in lavoro
- [blocked] bloccata
- [done] completata

---

## Task Aperte (priorità alta)

### Auth & UX
- [ ] Migliorare login/logout con edge cases (session expired, network error)
- [ ] Aggiungere reset password flow
- [done] Feedback visivi migliori (loading states, toast messages)

### Test & Quality
- [ ] Setup test unitari (Jest/Testing Library)
- [ ] Setup E2E test (Playwright/Cypress)
- [ ] Simulazione boomer: test flusso ordine completo

### Deploy & Config
- [ ] Configurare EAS build per Android
- [ ] Configurare deploy Netlify automatico
- [ ] Setup environment variables corrette

### Kiosk Features
- [ ] Modalità kiosk automatica (senza login)
- [ ] Timeout per tornare a home
- [ ] Ordine rapido senza account

---

## Task In Progress

### TypeScript Fix
- [done] Fix errori TypeScript (14→0) - VEDERE COMMIT

---

## Task Completate

### 2026-02-14
- [done] Boomer-tests: fix 14 errori TypeScript (syntax, icon, types, exports)
- [done] Boomer UX: aggiunto Toast feedback visivo quando si aggiunge al carrello

### 2026-02-13
- [done] Fix 14 errori TypeScript
- [done] Setup cron boomer-tests
- [done] Aggiunto README + netlify.toml

---

## Note
- Prima task: migliorare login/logout per robustness
- Seconda: setup test base
- Terza: deploy config
