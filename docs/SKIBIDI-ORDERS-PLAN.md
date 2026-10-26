# Skibidi Orders — Piano (decisioni ottobre 2026)

_Aggiornato il 2026-10-26 (main @ `970a3d1`, unite #38–#50). Dettaglio di PR, migration e seguiti in [`TODO.md`](./TODO.md)._

Questo documento sostituisce, per Pizzeria Ambrosia, le parti di `roadmap.md` in conflitto (pagamenti online, POS proprietario, fiscalità diretta).

## Posizionamento
- Skibidi è un **canale aggiuntivo** per gli **ordini d'asporto online**.
- **Non sostituisce** il POS né la cassa esistenti.
- **Pagamento solo alla cassa.** In v1 nessun pagamento online. Stripe forse in futuro, intestato alla pizzeria.

## Autenticazione
- Login **solo con Google** (eventualmente Facebook).
- **Niente guest**, niente email+password.

## Stati dell'ordine
1. In attesa di conferma
2. Accettato
3. In preparazione
4. Pronto
5. Ritirato e pagato
6. Rifiutato / Annullato

**Nessun ordine va in preparazione senza approvazione manuale** del personale.

## Antiabuso
- Limite di ordini aperti per account
- Rate limit lato server
- Cloudflare Turnstile
- Valore massimo dell'ordine
- Blocco degli account
- Storico dei mancati ritiri

## Rimandato
- Bot WhatsApp.

## Obiettivo finale: ordini nel POS esistente (Windows 10)
Ordine di preferenza per l'integrazione:
1. API del gestionale
2. Import di file
3. Integrazione del fornitore
4. Automazione GUI tramite Rakijazios (repo `CarmineMattia/rakijazios`, ex `rakazo-online`) — ultima scelta

**Fase temporanea:** dashboard ordini su Chrome alla cassa.

## Stato al 2026-10-26
- **Fatto (unito e live):**
  - login solo Google (#17, #31);
  - approvazione manuale con i nuovi stati (#18) e bottone "Non ritirato" (#26);
  - antiabuso lato DB (#20): login obbligatorio, limiti di valore e di ordini aperti, rate limit, blocco, mancati ritiri;
  - pagamento solo alla cassa (#19);
  - sicurezza DB (#28, #30, #32, #34, #40), prezzi calcolati sul server (#33);
  - fix React #418 su Vercel (#25, #29); menu ai clienti senza azienda (#35); foto Storage prima di quelle generate (#37);
  - editor admin che salva solo i campi cambiati (#39), "Ordine non trovato" (#45);
  - ricevute solo lato server/staff e scontrini in attesa emessi dallo staff (#44, #46);
  - CI con vitest e runner SQL (#43);
  - home e menu: pizze per prime, WhatsApp accanto a "Ordina", barra Menu/Offerte/Chiama, link veri e layout a 320px (#47–#50).
  - Migration di #40, #44 e #46 applicate su prod il 23/10.
- **Codice pronto ma spento o non eseguito:** Turnstile (#41: mancano chiavi e deploy di `verify-turnstile`); script dei 16 ordini vuoti (#38, pulizia non approvata).
- **Manca per la produzione** (dettaglio in [`TODO.md`](./TODO.md)): storia migration ancora da sistemare (`db push` fallisce), 11 foto, foto Malvasia 1/2 e 1L, descrizione Stria, fornitore fiscale reale (30 ricevute in attesa), WhatsApp Business sul fisso da confermare, POS, Playwright in CI e lint bloccante.

## Da verificare
- Nome e API del gestionale
- Contatto del fornitore del POS
- Edizione di Windows e permessi sulla macchina
- Chi può annullare un ordine già accettato

## Prossimi passi
1. PR per sistemare la storia delle migration (file con versioni uniche, file per le 6 righe solo su prod, decidere `20260904`), poi repair con l'OK di Carmine.
2. Foto mancanti e Malvasia (da Carmine), descrizione della Stria; decidere i 16 ordini vuoti.
3. Chiavi Turnstile e deploy di `verify-turnstile` (con l'OK di Carmine).
4. Playwright in CI e lint che può fallire.
5. Identificare il POS e il fornitore fiscale, e scegliere il metodo di integrazione.
