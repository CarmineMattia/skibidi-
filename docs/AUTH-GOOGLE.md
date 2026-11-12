# Login solo Google (Supabase OAuth)

Dal branch `feat/google-only-login` l'app accetta solo l'accesso con Google.
Rimossi: email+password (login e registrazione), codice OTP / magic link via email,
modalità ospite. Il menu resta navigabile senza login; checkout e ordine richiedono
un utente autenticato (`/modal` e `/one-screen-checkout` reindirizzano a `/login`).

## Configurazione da fare (non ancora fatta)

### Google Cloud Console
1. APIs & Services → OAuth consent screen: tipo *External*, nome "Pizzeria Ambrosia",
   email di supporto, dominio dell'app; scope `openid`, `email`, `profile`. Pubblicarla
   (in "Testing" entrano solo gli utenti di test).
2. Credentials → Create OAuth client ID → *Web application*.
   - Authorized JavaScript origins: `https://skibidi-eight-virid.vercel.app` (+ dominio
     definitivo, + `http://localhost:8081` per lo sviluppo).
   - Authorized redirect URIs: `https://zqubwvhstobaugifzoyb.supabase.co/auth/v1/callback`
3. Copiare Client ID e Client Secret.

### Supabase (progetto zqubwvhstobaugifzoyb)
1. Authentication → Sign In / Providers → **Google**: abilitare, incollare Client ID e Secret.
2. Authentication → URL Configuration. Allowlist **esatta**, senza wildcard.
   Non inserire `https://*.vercel.app/**` né `https://*.vercel.app/login`: un
   progetto Vercel di un altro account potrebbe ricevere il redirect.
   - Site URL: `https://skibidi-eight-virid.vercel.app`
   - Redirect URLs, una riga per URL:
     - `https://skibidi-eight-virid.vercel.app/login`
     - `http://localhost:8081/login`
     - `http://localhost:8081`
     - `http://127.0.0.1:8081/login`
     - `http://127.0.0.1:8081`
     - `pizzeriaambrosia://login` (deep link dell'app nativa, non è un wildcard)
   Se il dev server Expo stampa un'altra porta, aggiungere quell'origine scritta
   per intero (`http://localhost:PORTA/login`). Non usare un pattern.
3. **Anonymous sign-ins**: disattivato.
4. **Email provider**: se si usa l'accesso admin con password (vedi sotto) resta attivo ma
   con **Allow new users to sign up disattivato**, così `admin@skibidi.com` può
   ancora entrare e nessuno crea un account email nuovo. Se l'admin entra con Google,
   l'Email provider si può disattivare del tutto.
5. **Protezione password** (Authentication → Attack Protection / Password security):
   **Leaked password protection** acceso (controllo Have I Been Pwned).
6. **Collegamento identità** (pre-hijacking):
   - niente automatic linking di un'identità non confermata su un account esistente
     (stessa email Google / email);
   - **Secure email change** acceso, se il provider email resta acceso: la conferma
     va sia al vecchio indirizzo sia al nuovo;
   - non abilitare il phone provider.
7. **Rate limits** (Authentication → Rate Limits): non alzarli. Tenere i limiti di
   sign-in / sign-up, verifica token e refresh. Con le registrazioni email spente
   il limite di sign-up conta comunque per Google.
8. (Facoltativo, più avanti) Facebook: abilitare il provider e buildare con
   `EXPO_PUBLIC_ENABLE_FACEBOOK_LOGIN=true`. Di default il pulsante non compare.
   Aggiungere il redirect esatto del provider, non un wildcard Vercel.

## Accesso admin

**Opzione consigliata: admin via Google.** L'admin entra una volta con il suo account
Google: il trigger `handle_new_user` crea il profilo `customer`. Poi, da SQL editor,
si promuove quel profilo (non applicato da questa PR):

```sql
update public.profiles
set role = 'admin',
    company_id = (select company_id from public.profiles where email = 'admin@skibidi.com')
where email = '<account-google-admin>@gmail.com';
```

Nessuna password da custodire; `admin@skibidi.com` (password debole) può poi essere disattivato.

**Ripiego: login admin nascosto, spento di default.** Se serve ancora `admin@skibidi.com`:
buildare con `EXPO_PUBLIC_ENABLE_ADMIN_PASSWORD_LOGIN=true` e aprire `/login?admin=1`.
Il form chiama `signInWithPassword`, poi legge `profiles.role`: se non è `admin` fa subito
`signOut`. Nell'app non esiste più la registrazione con password. Prima di accenderlo
cambiare la password di `admin@skibidi.com`.

## Note
- `handle_new_user` non legge `role` né `company_id` da `raw_user_meta_data`.
  Il profilo nuovo è `customer`. La company è quella scelta dal database
  (`default_customer_company_id`: l'unica company attiva; se non ce n'è una sola,
  resta vuota). La promozione ad admin si fa dal SQL editor, come nello snippet sopra.
- Il client non aggiorna `profiles.role` né `profiles.company_id` (niente
  `setUserRole`). I grant di colonna e il trigger rifiutano la scrittura anche
  se qualcuno chiama l'API a mano.
- Il vincolo "solo utenti loggati ordinano" è nella RPC `create_order_with_items`
  (migration antiabuso). Il tracking richiede che `auth.uid()` sia il cliente
  dell'ordine oppure staff della stessa pizzeria.
