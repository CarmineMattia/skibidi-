# Skibidi Orders — Piano (decisioni ottobre 2026)

_Aggiornato il 2026-10-22 (dopo il merge di #35, #36 e #37; batch #38–#42 aperto). Dettaglio di PR, migration e seguiti in [`TODO.md`](./TODO.md)._

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
  - fix React #418 su Vercel (#25, #29);
  - menu visibile anche ai clienti senza azienda, cioè ai nuovi utenti Google (#35, migration applicata il 21/10);
  - le foto vere in Storage hanno la precedenza su quelle generate (#37).
- **In attesa dell'OK di Carmine:**
  - batch del 22/10, PR aperte e testate da Skibidi Tester (dettaglio in [`TODO.md`](./TODO.md)): #38 script ordini vuoti, #39 editor admin, #40 note e permessi (migration solo nella PR), #41 Turnstile, #42 questi documenti;
  - pulizia dei 16 ordini vuoti e foto dei prodotti mancanti (vedi [`piano-dati-2026-10-21.md`](./piano-dati-2026-10-21.md)).
- **Ancora da fare per l'antiabuso:** Cloudflare Turnstile: codice in #41, poi chiavi di Carmine e deploy di `verify-turnstile` (vedi `docs/ANTIABUSE.md`).

## Da verificare
- Nome e API del gestionale
- Contatto del fornitore del POS
- Edizione di Windows e permessi sulla macchina
- Chi può annullare un ordine già accettato

## Prossimi passi
1. Un ordine di prova controllato con un nuovo account Google (menu visibile, prezzi del server).
2. Decidere i 16 ordini vuoti e caricare le foto mancanti (piano dati).
3. Mettere vitest e i runner SQL in CI e chiudere i seguiti di sicurezza in `TODO.md`.
4. Identificare il POS (chiedere al proprietario e al fornitore) e scegliere il metodo di integrazione.
