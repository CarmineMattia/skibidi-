# Skibidi Orders — Piano (decisioni ottobre 2026)

_Aggiornato il 2026-10-21 (main @ `5d0e9c7`). Dettaglio di PR, migration e seguiti in [`TODO.md`](./TODO.md)._

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

## Stato al 2026-10-21
- **Fatto (unito e live):**
  - login solo Google (#17, #31);
  - approvazione manuale con i nuovi stati (#18) e bottone "Non ritirato" (#26);
  - antiabuso lato DB (#20): login obbligatorio, limiti di valore e di ordini aperti, rate limit, blocco, mancati ritiri;
  - pagamento solo alla cassa (#19);
  - sicurezza DB (#28, #30, #32, #34): funzioni SECURITY DEFINER, privilegi, `order_items` scrivibili solo con `create_order_with_items`, ordine bloccato per il cliente dopo l'invio;
  - prezzi calcolati sul server (#33);
  - fix React #418 su Vercel (#25, #29).
- **In attesa dell'OK di Carmine:**
  - #35: menu visibile ai clienti senza azienda, cioè ai nuovi utenti Google (merge + migration);
  - pulizia dei 16 ordini vuoti e foto dei prodotti mancanti (vedi [`piano-dati-2026-10-21.md`](./piano-dati-2026-10-21.md)).
- **Ancora da fare per l'antiabuso:** Cloudflare Turnstile (serve il deploy di `verify-turnstile`).

## Da verificare
- Nome e API del gestionale
- Contatto del fornitore del POS
- Edizione di Windows e permessi sulla macchina
- Chi può annullare un ordine già accettato

## Prossimi passi
1. Unire #35 e applicarne la migration (con l'OK di Carmine), poi un ordine di prova controllato.
2. Decidere i 16 ordini vuoti e caricare le foto mancanti (piano dati).
3. Mettere vitest e i runner SQL in CI e chiudere i seguiti di sicurezza in `TODO.md`.
4. Identificare il POS (chiedere al proprietario e al fornitore) e scegliere il metodo di integrazione.
