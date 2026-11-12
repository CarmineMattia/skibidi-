# Skibidi Coin — Fase 1

Punti fedeltà interni di Pizzeria Ambrosia. Stanno nel database, non su una blockchain. Non sono una criptovaluta, non si vendono per euro e non si trasferiscono da un cliente all'altro. Si usano solo al banco di Ambrosia (company `00000000-0000-0000-0000-000000000001`). Lo schema resta multi-company: ogni saldo, movimento e impostazione ha la propria company.

La fase 2 (ricariche a pagamento) è ferma. Non c'è una funzione, una schermata o uno stub per comprare punti.

## Regole (Carmine)

- 1 punto per ogni euro intero di merce, sul lordo prima dello sconto punti. Si prende il floor della somma delle righe `order_items`. La consegna, se è separata dal totale merci, non conta. Lo sconto confermato non riduce i punti che l'ordine farà guadagnare.
- 100 punti = 5 € di sconto.
- I punti scadono 12 mesi dopo l'accredito (anche gli omaggi).
- Il cliente può chiedere di usarli, a multipli di 100. La richiesta non prenota i punti: due ordini possono chiedere lo stesso saldo e la seconda conferma in cassa fallisce con «Punti insufficienti». Una prenotazione che blocchi il saldo è un seguito, non è in questa fase.
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

File: `supabase/migrations/20261112020000_skibidi_coin.sql` e `supabase/migrations/20261112030000_skibidi_coin_tracking.sql`.

La seconda aggiunge `points_requested`, `points_redeemed`, `points_discount_eur` e `points_confirmed_at` a `get_order_tracking`. Non aggiunge nome, telefono, note o indirizzo. La legge chi è il proprietario dell'ordine, lo staff della stessa company o il kiosk della stessa company (`anon` non esegue la funzione). Se sul database c'è già la funzione ristretta di `20261111234500`, si aggiungono solo quei campi. Se c'è ancora la funzione vecchia che restituiva l'ordine intero, viene sostituita con la forma ristretta più i campi punti. `points_confirmed_by` resta fuori: è l'id dello staff.

Si applicano nell'ordine del nome file, insieme a quelle appena precedenti: `20261111234500`, `20261112003000`, `20261112010000`, poi `20261112020000` e `20261112030000`. `20261111234500` ricrea `get_order_tracking`. Se viene applicata dopo `20261112030000`, la funzione torna senza i campi `points_*`. Riapplicare `20261112030000` li rimette.

Non sono applicate al progetto ospitato. Vanno eseguite solo con l'ok di Carmine, come le altre migration di questo repo. Non toccano `storage`, `auth` o `realtime`. I test SQL girano su PGlite, in locale, con `npm run test:sql`. Nessun ordine reale e nessun test contro la produzione.

`loyalty_expire_due(company)` scrive le righe `expire` di audit. Il saldo le esclude già quando `expires_at` è passato, quindi non serve un cron perché i punti scaduti restino fuori dal saldo. La funzione è idempotente.

## Schermate

- Account e premi: saldo, punti in scadenza (30 giorni) e storico. La pagina premi non mostra più punti finti.
- Checkout (schermata unica e modale): il cliente loggato può spuntare «Usa i punti». La didascalia è «da confermare in cassa». Il totale visualizzato resta quello di merce e consegna. Se il server rifiuta la richiesta, la pagina mostra la frase italiana del codice (`Punti insufficienti`, programma spento, quantità non valida, operazione non consentita) e non il messaggio generico di invio non confermato. Le stesse frasi compaiono sulla conferma in cucina e sull'omaggio.
- Tracking: «Punti richiesti: da confermare in cassa», «Sconto punti confermato in cassa» oppure «Sconto punti non applicato».
- Scontrino digitale e copia di cortesia stampata: il totale lordo resta `total_amount`. Se lo sconto è confermato compaiono «Sconto punti Skibidi Coin -€X» e «Importo da pagare» (lordo meno lo sconto confermato, mai sotto zero). Sulla copia stampata «Importo pagato» e la riga del metodo di pagamento sono quello stesso importo. Se è solo richiesto, compare «Punti richiesti: da confermare in cassa» e «Importo pagato» resta il lordo. Lo sconto si applica al banco. Il modulo fiscale e il registratore telematico non vengono modificati: continuano a vedere il lordo. Sulla copia di cortesia la riga «di cui IVA sul totale» sta subito sotto «TOTALE COMPLESSIVO» ed è calcolata sul lordo, così non si legge come IVA sull'importo da pagare.
- Cucina: sull'ordine c'è «Conferma sconto punti in cassa». Finché è solo una richiesta, la card dice «Punti richiesti: da confermare in cassa». Dopo la conferma, accanto al totale lordo compare «Importo da pagare €X». Il pannello «Regala punti» cerca il cliente, chiede quantità e motivo, e mostra lo storico della company.
- La pagina `/rewards` ha il titolo «Punti».

## Decisioni già prese

- L'accredito è sul lordo della merce, prima dello sconto punti, senza la consegna. Un ordine da 20 € di pizza con 5 € di sconto accredita 20 punti.
- La richiesta non prenota i punti. La seconda conferma può fallire e il messaggio in pagina è «Punti insufficienti». Bloccare il saldo alla richiesta è un seguito.
- `total_amount` non cambia. Sulla copia di cortesia e sullo scontrino in app lo sconto è una riga in più, e «Importo da pagare» è il lordo meno lo sconto già confermato (mai sotto zero). Sulla copia stampata «Importo pagato» e la riga del metodo di pagamento usano quell'importo. In cucina la stessa cifra sta accanto al totale lordo. Il registratore telematico e il modulo fiscale restano sul lordo: lo sconto si applica in cassa.
- Le commissioni (il resoconto già in app) restano calcolate sul lordo. Se debbano usare l'importo pagato dopo lo sconto punti è una decisione ancora aperta.

## Domande aperte

1. Il documento fiscale emesso dal registratore deve ripetere la riga di sconto, oppure lo sconto resta solo un movimento di cassa fuori dallo scontrino fiscale.
2. Le commissioni devono restare sul lordo oppure passare all'importo pagato dopo lo sconto punti.
3. Le ricariche a pagamento restano fuori (fase 2).
4. L'omaggio accetta qualsiasi intero da 1 a 10000, non solo multipli di 100.
5. «In scadenza» sono i lotti ancora aperti che scadono entro 30 giorni.
6. Motivo di omaggio e storno: da 3 a 500 caratteri.
7. Il lock è `FOR UPDATE` nella stessa transazione. PGlite non apre due sessioni, quindi il test di concorrenza controlla il sorgente della funzione e il secondo riscatto sequenziale, non due connessioni vere.
8. Il kiosk non conferma e non regala punti.
9. Lo storno di un riscatto confermato azzera la conferma, e la cassa può confermare di nuovo.
10. Non c'è un job schedulato per `loyalty_expire_due`: il saldo ignora già le righe scadute. Le righe `expire` sono solo la traccia.
11. Un insert diretto da postgres può mettere `points_requested` senza passare da `loyalty_normalize_request`. La conferma ricontrolla multiplo, saldo e merce.
12. Un ordine con righe nel registro non si cancella (`ON DELETE RESTRICT`).
