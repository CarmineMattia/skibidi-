# Skibidi Orders — Piano (decisioni ottobre 2026)

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

## Da verificare
- Nome e API del gestionale
- Contatto del fornitore del POS
- Edizione di Windows e permessi sulla macchina
- Stato reale di auth e antiabuso nel codice (vedi `docs/TODO.md`)

## Prossimi passi
1. Identificare il POS (chiedere al proprietario e al fornitore).
2. Rendere Skibidi pronto per ordini reali.
3. Scegliere il metodo di integrazione.
