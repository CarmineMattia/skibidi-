# Skibidi Coin — Fase 1

Punti fedeltà interni di Pizzeria Ambrosia. Stanno nel database, non su una blockchain. Non sono una criptovaluta, non si vendono per euro e non si trasferiscono da un cliente all'altro. Si usano solo al banco di Ambrosia (company `00000000-0000-0000-0000-000000000001`). Lo schema resta multi-company: ogni saldo, movimento e impostazione ha la propria company.

La fase 2 (ricariche a pagamento) è ferma. Non c'è una funzione, una schermata o uno stub per comprare punti.

## Regole (Carmine)

- 1 punto per ogni euro intero di merce. Si prende il floor della somma delle righe `order_items`. La consegna, se è separata dal totale merci, non conta.
- 100 punti = 5 € di sconto.
- I punti scadono 12 mesi dopo l'accredito (anche gli omaggi).
- Il cliente può chiedere di usarli, a multipli di 100. La richiesta resta «da confermare in cassa»: il totale dell'ordine non cambia nel client.
- Lo sconto diventa effettivo solo quando lo staff lo conferma insieme al pagamento (`loyalty_confirm_redeem`).
- I punti dell'ordine si accreditano solo quando lo stato passa a `delivered` (ritirato e pagato). Annullato, rifiutato, non ritirato, vuoto o senza cliente: niente punti.
- Un accredito sbagliato si corregge con una riga di storno (`loyalty_reverse`). Le righe del registro non si modificano e non si cancellano.

Impostazioni per company, in `loyalty_settings`: `points_per_euro`, `points_per_redeem_unit` (100), `redeem_value_eur` (5), `expiry_months` (12), `enabled`. Il programma nasce acceso solo per Ambrosia. Le altre company restano spente, anche se nascono dopo.

## Dati

- `loyalty_accounts`: un conto per coppia (cliente, company).
- `loyalty_ledger`: registro append-only. Tipi `earn_order`, `redeem`, `gift`, `reversal`, `expire`. La quantità è con segno. `order_id` può essere nullo. Omaggio, riscatto e storno registrano lo staff e, dove serve, il motivo. `expires_at` sulle entrate (accredito e omaggio).
- Il saldo è la somma delle righe non scadute (`loyalty_balance`, `SECURITY DEFINER`, `search_path = public`). La vista `loyalty_balances` è `security_invoker`.
- Un riscatto taglia i lotti dal più vicino a scadere e copia la loro `expires_at`, così la parte spesa e quella rimasta invecchiano insieme e il saldo non va sotto zero.
- Un accredito per ordine (indice unico parziale). La conferma prende il lock della riga ordine e poi del conto (`FOR UPDATE`), quindi due casse non spendono gli stessi punti.
- Sull'ordine: `points_requested`, `points_redeemed`, `points_discount_eur`, `points_confirmed_at`, `points_confirmed_by`. Li scrive solo una funzione che imposta `skibidi.loyalty_write`. Un update diretto riceve `LOYALTY_POINTS_LOCKED`.

## Sicurezza

RLS su impostazioni, conti e registro. Il cliente legge solo i propri. `anon` non ha privilegi. Nessuna policy di insert, update o delete per il client: le scritture passano da funzioni `SECURITY DEFINER` con `REVOKE` verso `PUBLIC`, `anon` e `authenticated`, e `GRANT EXECUTE` solo sulle funzioni dell'app.

Omaggio e conferma riscatto: solo staff della stessa company. `is_admin()` è il ruolo staff, lo stesso della cucina. Il kiosk non è staff. L'omaggio richiede un motivo (3–500 caratteri) e registra chi lo ha fatto. Quantità omaggio: da 1 a 10000, non per forza un multiplo di 100.

L'accredito è il trigger `trg_loyalty_credit_on_delivered`, dopo l'update dello stato a `delivered`. Non sostituisce `trg_enforce_order_manual_approval` né `trg_prevent_customer_order_tampering`. Un cliente non può portarsi da solo un ordine a consegnato, e non può chiamare `loyalty_credit_order`.

## GDPR

I punti sono una condizione del rapporto con la pizzeria, non un trattamento di profilazione. Non ci sono segmenti, punteggi di comportamento, raccomandazioni o grafici sul cliente. Lo storico mostra solo i movimenti del conto.

## Migration

File: `supabase/migrations/20261112020000_skibidi_coin.sql`.

Non è applicata al progetto ospitato. Va eseguita solo con l'ok di Carmine, come le altre migration di questo repo. Non tocca `storage`, `auth` o `realtime`. I test SQL girano su PGlite, in locale, con `npm run test:sql`. Nessun ordine reale e nessun test contro la produzione.

`loyalty_expire_due(company)` scrive le righe `expire` di audit. Il saldo le esclude già quando `expires_at` è passato, quindi non serve un cron perché i punti scaduti restino fuori dal saldo. La funzione è idempotente.

## Schermate

- Account e premi: saldo, punti in scadenza (30 giorni) e storico. La pagina premi non mostra più punti finti.
- Checkout (schermata unica e modale): il cliente loggato può spuntare «Usa i punti». La didascalia è «da confermare in cassa». Il totale visualizzato resta quello di merce e consegna.
- Cucina: sull'ordine c'è «Conferma sconto punti in cassa». Il pannello «Regala punti» cerca il cliente, chiede quantità e motivo, e mostra lo storico della company.

## Domande aperte

1. Lo sconto confermato non modifica `total_amount`. Scontrino e fiscale continuano a vedere il totale pieno, con lo sconto solo nelle colonne punti. Va deciso se il documento commerciale deve stampare la riga di sconto.
2. L'accredito usa il floor della merce, non il netto dopo lo sconto punti e non «gli euro davvero pagati». Un ordine da 20 € con 5 € di sconto accredita comunque 20 punti.
3. La richiesta non prenota i punti. Due ordini possono chiedere lo stesso saldo: la seconda conferma fallisce con punti insufficienti.
4. Le ricariche a pagamento restano fuori (fase 2).
5. L'omaggio accetta qualsiasi intero da 1 a 10000, non solo multipli di 100.
6. «In scadenza» sono i lotti ancora aperti che scadono entro 30 giorni.
7. Motivo di omaggio e storno: da 3 a 500 caratteri.
8. Il lock è `FOR UPDATE` nella stessa transazione. PGlite non apre due sessioni, quindi il test di concorrenza controlla il sorgente della funzione e il secondo riscatto sequenziale, non due connessioni vere.
9. Il kiosk non conferma e non regala punti.
10. Lo storno di un riscatto confermato azzera la conferma, e la cassa può confermare di nuovo.
11. Non c'è un job schedulato per `loyalty_expire_due`: il saldo ignora già le righe scadute. Le righe `expire` sono solo la traccia.
12. Un insert diretto da postgres può mettere `points_requested` senza passare da `loyalty_normalize_request`. La conferma ricontrolla multiplo, saldo e merce.
13. Un ordine con righe nel registro non si cancella (`ON DELETE RESTRICT`).
