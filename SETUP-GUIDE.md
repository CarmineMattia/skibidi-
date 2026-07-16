# 📘 Setup Guide - SKIBIDI ORDERS

> **Nuovo contributor?** Flusso consigliato: [README.md](./README.md) → questa guida → [CONTRIBUTING.md](./CONTRIBUTING.md) (branch + PR).

## Setup rapido (clone → run)

```bash
git clone https://github.com/CarmineMattia/skibidi-.git
cd skibidi-
npm install
cp .env.example .env
```

1. Compila almeno `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_COMPANY_ID` in `.env`.
2. Applica le migration in `supabase/migrations/` sul progetto Supabase (in ordine di nome file), oppure usa un progetto condiviso dal team già aggiornato.
3. Avvia: `npm run web` (oppure `npm start` e premi `w`).
4. Verifica: `npm run type-check`.

Dettagli Auth OTP, SMTP e troubleshooting sotto.

---

## ✅ Cosa è stato fatto (FASE 1)

### 1. Scaffolding Progetto
- ✅ Inizializzato progetto Expo con TypeScript
- ✅ Configurato Expo Router v6 per la navigazione
- ✅ Impostato strict mode TypeScript

### 2. Styling e UI
- ✅ Installato e configurato NativeWind v4 (Tailwind CSS per React Native)
- ✅ Creato design system stile shadcn/ui con CSS variables
- ✅ Implementati componenti base:
  - `Button` con varianti (default, destructive, outline, secondary, ghost, link)
  - `Card` con subcomponenti (CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- ✅ Configurato metro bundler per supportare NativeWind
- ✅ Creata utility `cn()` per combinare classi Tailwind

### 3. Struttura Cartelle Scalabile
```
├── app/              # Routing
├── components/       # Componenti UI
│   ├── ui/          # Componenti base riutilizzabili
│   └── features/    # Componenti feature-specific
├── lib/             # Business logic
│   ├── api/         # Supabase client, providers
│   ├── fiscal/      # Fiscalità (per Fase 3)
│   ├── hooks/       # Custom hooks
│   ├── stores/      # State management
│   └── utils/       # Utilities
└── types/           # TypeScript types
```

### 4. Backend Setup
- ✅ Installato Supabase client
- ✅ Configurato TanStack Query v5 per caching
- ✅ Creato QueryProvider con configurazione ottimizzata per POS
- ✅ Definiti TypeScript types per database schema
- ✅ Creato file `.env.example` per configurazione

### 5. Database Schema
- ✅ Creato schema completo SQL (`supabase-schema.sql`) con:
  - 5 tabelle principali (profiles, categories, products, orders, order_items)
  - Enums per user_role, fiscal_status, order_status
  - Indici per performance
  - Trigger per updated_at automatico
  - Row Level Security (RLS) policies complete
  - Seed data di esempio

## 🚦 Prossimi Passi per Completare il Setup

### Step 1: Configura Supabase

1. **Crea un progetto Supabase**
   - Vai su https://supabase.com
   - Clicca "New Project"
   - Scegli un nome (es. "skibidi-orders")
   - Salva la password del database

2. **Esegui lo schema SQL**
   - Nel tuo progetto Supabase, vai in "SQL Editor"
   - Clicca "New Query"
   - Copia e incolla tutto il contenuto di `supabase-schema.sql`
   - Clicca "Run" per eseguire

3. **Ottieni le credenziali**
   - Vai in "Settings" > "API"
   - Copia:
     - `Project URL` (es. https://xxxxx.supabase.co)
     - `anon public` key

4. **Configura le variabili d'ambiente**
   ```bash
   # Crea il file .env nella root del progetto
   cp .env.example .env
   ```

   Apri `.env` e inserisci:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...tua-chiave-qui
   ```

### Step 2: Test del Setup

1. **Avvia il progetto**
   ```bash
   npm start
   ```

2. **Premi 'w' per aprire in browser** oppure scansiona il QR code con Expo Go

3. **Verifica che NativeWind funziona**
   - Dovresti vedere l'app con lo styling applicato
   - Controlla la console per eventuali errori

### Step 3: (Opzionale) Aggiungi dati di test

1. Nel Supabase SQL Editor, dopo aver creato le categories, ottieni i loro ID:
   ```sql
   SELECT id, name FROM categories;
   ```

2. Inserisci prodotti di test:
   ```sql
   INSERT INTO products (category_id, name, description, price, display_order) VALUES
       ('uuid-panini', 'Hamburger Classico', 'Con lattuga, pomodoro e salse', 8.50, 1),
       ('uuid-panini', 'Cheeseburger', 'Con formaggio cheddar', 9.00, 2),
       ('uuid-bevande', 'Coca Cola', 'Lattina 33cl', 2.50, 1),
       ('uuid-dolci', 'Tiramisù', 'Fatto in casa', 4.50, 1);
   ```

3. Crea un utente admin:
   - Vai in "Authentication" > "Users" > "Add user"
   - Inserisci email e password
   - Copia l'UUID dell'utente creato
   - Esegui in SQL Editor:
     ```sql
     INSERT INTO profiles (id, role, email, full_name)
     VALUES ('uuid-utente', 'admin', 'admin@test.com', 'Admin');
     ```

## 🔑 Login passwordless (config dashboard Supabase)

Il login passwordless (codice OTP a 6 cifre + magic link nella stessa email) richiede
configurazione manuale nel dashboard Supabase — senza questi passi il flusso NON funziona:

1. **Auth → Email Templates — modifica ENTRAMBI i template:**
   - **"Magic Link"** (inviato agli utenti esistenti) e **"Confirm signup"** (inviato ai
     nuovi utenti creati via OTP) devono contenere sia `{{ .ConfirmationURL }}` sia `{{ .Token }}`.
   - Copy suggerita:
     ```
     Clicca il link per accedere: {{ .ConfirmationURL }}
     Oppure inserisci questo codice nell'app: {{ .Token }}
     ```
   - ⚠️ Se manca `{{ .Token }}` su "Confirm signup", i nuovi utenti su app nativa
     ricevono una mail senza codice e non possono entrare.

2. **Auth → URL Configuration:**
   - **Site URL**: origin web di produzione (es. `https://pizzeriaambrosia.skibidiorders.com`)
   - **Additional Redirect URLs**: `http://localhost:8081/**` (dev) e
     `https://*.skibidiorders.com/**` (sottodomini tenant)

3. **SMTP custom (obbligatorio per uso reale):**
   - L'SMTP built-in di Supabase invia ~2 email/ora e SOLO agli indirizzi dei membri
     del team del progetto → va bene solo per i primi test.
   - Configura un provider (es. [Resend](https://resend.com), Postmark) in
     **Project Settings → Auth → SMTP**, poi alza i rate limit in **Auth → Rate Limits**.

4. **Auth → Providers → Email:** signups abilitati (richiesto da `shouldCreateUser`).
   OTP expiry: default 3600s ok (valutare 900s in produzione).

Note comportamento:
- I nuovi utenti creati via OTP nascono sempre con ruolo `customer` (+ `company_id` del
  tenant, passato nei metadata). Gli admin si creano solo dal flusso password con scelta ruolo.
- Su nativo il magic link punta alla web app (`EXPO_PUBLIC_WEB_URL`); l'accesso in-app
  avviene digitando il codice a 6 cifre.

## 🧪 Test Rapido della Configurazione

Crea un file di test `app/(tabs)/test.tsx`:

```typescript
import { View, Text } from 'react-native';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export default function TestScreen() {
  return (
    <View className="flex-1 p-4 bg-background">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Test NativeWind</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-muted-foreground mb-4">
            Se vedi questo styled correttamente, NativeWind funziona! 🎉
          </Text>
          <Button title="Test Button" onPress={() => alert('Funziona!')} />
        </CardContent>
      </Card>
    </View>
  );
}
```

## 🌐 Browser Performance (web) — LCP & CLS per pagina

Regole permanenti per il rendering web (Expo Router `web.output: "static"`):
il primo viewport deve dipingere prima dell'hydration, l'elemento LCP è
esplicito, gli stati di caricamento mantengono le dimensioni finali e le
animazioni usano solo `transform`/`opacity`.

| Pagina | Elemento LCP | Strategia CLS / caricamento |
|---|---|---|
| `/` (home) | Hero `interior.jpeg` in `LandingHero` | `min-h` via breakpoint CSS (`sm:`/`md:`), layout identico pre/post hydration; offerte → `SkeletonHomeOffers` |
| `/menu` | Griglia prodotti (prima card) | `SkeletonMenuScreen` + `SkeletonProductCard` ad altezza fissa (`h-[330/380/450px]`); card reali ad altezza fissa |
| `/login` | Logo (128×64 espliciti) + titolo | Nessun fetch bloccante; form OTP renderizza subito |
| `/kitchen` | Header + griglia ordini | `SkeletonKitchenGrid`; orologio a componente isolato (tick 1 s locale, screen tick 30 s) |
| `/admin-dashboard` | Header + metriche | `SkeletonDashboardMetrics`; query gated su `isAdmin` |
| `/modal` (checkout) | Step corrente | Mappa delivery: box riservato `h-[220px]`, chunk maplibre lazy via `React.lazy` |
| `/order-success` | Cerchio check + titolo | Entrance solo `transform/opacity`, delay 150 ms, `useReducedMotion` → render immediato |
| `/two` (ordini) | Header card | `FlatList` virtualizzata + `SkeletonOrderCard` |

Invarianti da non regredire:
- `app/_layout.tsx`: su web **non** bloccare il render sul font gate (`return null` solo su nativo) — il testo usa lo stack di sistema, le icone FontAwesome arrivano dopo.
- `app/+html.tsx`: `preconnect` a Supabase + `dns-prefetch` a flagcdn; CSS globale `prefers-reduced-motion` che azzera animazioni/transizioni.
- Niente `lazy-load` sull'immagine principale above-the-fold; niente spinner che collassano in blocchi grandi (usare gli skeleton di `components/ui/Skeleton.tsx` a dimensioni finali).
- Layout first-paint da breakpoint CSS (`sm:`/`md:`/`web:md:`), non da `useWindowDimensions` (che su web static parte a 390px e rilayouta dopo l'hydration).
- Asset landing: JPEG ricompressi (≤1920px, q74). Nuove immagini grandi vanno compresse prima del commit.
- Terze parti fuori dal critical path: Supabase realtime solo su kitchen/admin, maplibre solo nel campo delivery (lazy), geocoding solo su input utente, fiscal service init sincrono senza rete.

## 📚 Risorse Utili

- [Expo Documentation](https://docs.expo.dev/)
- [NativeWind Docs](https://www.nativewind.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)

## 🐛 Troubleshooting

### Errore: "Supabase credentials not found"
- Verifica che il file `.env` esista nella root
- Controlla che le variabili inizino con `EXPO_PUBLIC_`
- Riavvia il server Expo dopo aver modificato `.env`

### Tailwind classes non funzionano
- Verifica che `global.css` sia importato in `app/_layout.tsx`
- Controlla che `metro.config.js` includa la configurazione NativeWind
- Prova a cancellare la cache: `npx expo start --clear`

### TypeScript errors
- Esegui `npm install` per assicurarti che tutte le dipendenze siano installate
- Riavvia il TypeScript server nel tuo editor

## ✨ Pronto per la Fase 2!

Una volta completato il setup:
1. Verifica che l'app parta senza errori
2. Controlla che Supabase sia configurato correttamente
3. Testa i componenti UI creati

Sei pronto per iniziare la **Fase 2** del roadmap: implementazione del Menu e Carrello!

---

**Questions?** Rivedi il `README.md` o il `roadmap.md` per maggiori dettagli.
