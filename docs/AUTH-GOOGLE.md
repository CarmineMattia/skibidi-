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
2. Authentication → URL Configuration:
   - Site URL: URL di produzione.
   - Redirect URLs: `https://skibidi-eight-virid.vercel.app/login`, le preview Vercel
     (`https://*.vercel.app/login` ristretto al proprio team), `http://localhost:8081/login`,
     `pizzeriaambrosia://login` (app nativa).
3. **Anonymous sign-ins**: disattivato.
4. **Email provider**: se si usa l'accesso admin con password (vedi sotto) resta attivo ma
   con la registrazione via email **disattivata**. Se l'admin entra con Google,
   l'Email provider si può disattivare del tutto.
5. (Facoltativo, più avanti) Facebook: abilitare il provider e buildare con
   `EXPO_PUBLIC_ENABLE_FACEBOOK_LOGIN=true`. Di default il pulsante non compare.

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
- Nuovi utenti Google: `company_id` nel profilo resta `null` (prima veniva passato nei
  metadata dell'OTP). Se una policy lo richiede sul profilo cliente va gestito nel trigger.
- Il vincolo "solo utenti loggati ordinano" oggi è lato client; il controllo lato DB
  (RPC/policy che rifiuta `auth.uid() is null`) va nella PR antiabuso.
