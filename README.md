# 🚽 SKIBIDI ORDERS

> Sistema POS per ristorazione con infinite Rizz. No cap.

Sistema proprietario per la ristorazione che unifica l'esperienza Consumatore (Web/Mobile) e Gestore/Totem (App Nativa Kiosk). Gestisce ordini, pagamenti e fiscalità italiana tramite comunicazione diretta con Registratori Telematici (RT) Epson.

## 📦 Stack Tecnologico

- **Framework**: React Native (Expo SDK 54)
- **Linguaggio**: TypeScript (Strict Mode)
- **Routing**: Expo Router v6
- **Styling**: NativeWind (Tailwind CSS per React Native)
- **UI Components**: Design System personalizzato stile shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **State Management**: React Context + TanStack Query v5
- **Icons**: Expo Vector Icons + Lucide React Native

## 🏗️ Struttura del Progetto

```
skibidi-orders/
├── app/                      # Routing (Expo Router)
│   ├── (tabs)/              # Tab navigation principale
│   └── _layout.tsx          # Root layout con providers
├── components/              # Componenti riutilizzabili
│   ├── ui/                  # Componenti UI base (Button, Card, etc.)
│   └── features/            # Componenti feature-specific
├── lib/                     # Business logic
│   ├── api/                 # Supabase client, Query provider
│   ├── fiscal/              # Logica fiscalità (RT Epson)
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Context providers
│   └── utils/               # Utility functions
├── types/                   # TypeScript type definitions
│   └── database.types.ts    # Database schema types
├── assets/                  # Immagini, font, etc.
├── global.css              # CSS globale (Tailwind)
├── tailwind.config.js      # Configurazione Tailwind
└── supabase-schema.sql     # Schema SQL per Supabase
```

## 🚀 Setup Iniziale

### 1. Clona e Installa Dipendenze

```bash
cd "skibidi orders"
npm install
```

### 2. Configura Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto
2. Vai nella SQL Editor e esegui il contenuto del file `supabase-schema.sql`
3. Copia `.env.example` in `.env`:
   ```bash
   cp .env.example .env
   ```
4. Inserisci le tue credenziali Supabase nel file `.env`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 3. Avvia il Progetto

```bash
# Web (browser)
npm run web

# Android (emulatore o dispositivo)
npm run android

# iOS (solo su macOS)
npm run ios

# Expo Dev Client
npm start
```

## ✅ FASE 1 - Completata

- [x] Inizializzazione progetto Expo con TypeScript e Expo Router
- [x] Configurazione NativeWind (Tailwind) per Native e Web
- [x] Design system base (colori, tipografia, componenti atomici stile shadcn)
- [x] Setup Supabase con TypeScript types
- [x] Schema database con tabelle e RLS policies
- [x] Struttura cartelle scalabile

## 🎨 Design System

Il progetto utilizza un design system ispirato a shadcn/ui con CSS variables per i colori:

```typescript
// Usa i componenti UI pre-configurati
import { Button, Card, CardHeader, CardTitle } from '@/components/ui';

// Oppure usa direttamente le classi Tailwind
<View className="bg-primary rounded-lg p-4">
  <Text className="text-primary-foreground font-semibold">Hello</Text>
</View>
```

### Palette Colori

Tutti i colori sono configurabili tramite CSS variables in `global.css`:

- `primary` - Colore primario
- `secondary` - Colore secondario
- `destructive` - Per azioni distruttive
- `muted` - Testi e elementi secondari
- `accent` - Accenti e highlights
- `background` / `foreground` - Sfondo e testo principale
- `card` - Componenti card
- `border` / `input` / `ring` - Bordi e focus

## 🗄️ Database Schema

### Tabelle Principali

- **profiles**: Profili utenti (admin, customer, kiosk)
- **categories**: Categorie prodotti
- **products**: Prodotti del menù
- **orders**: Ordini con stato e fiscalizzazione
- **order_items**: Dettaglio items per ordine

### Row Level Security (RLS)

Tutte le tabelle hanno RLS abilitato con policies appropriate:
- Utenti possono vedere solo i propri ordini
- Admin e Kiosk hanno accesso completo
- Prodotti attivi visibili a tutti

## 📱 Prossimi Passi (Fase 2)

Vedi `roadmap.md` per la roadmap completa del progetto.

La Fase 2 includerà:
- Implementazione navigazione e layout responsive
- Componente ProductCard e griglia Menu
- Logica Carrello (Context locale)
- Autenticazione (Login Admin vs Accesso Anonimo Kiosk)

## 🤝 Contribuire

Questo è un progetto proprietario. Per contribuire, contatta il team di sviluppo.

## 📄 Licenza

Proprietario - Tutti i diritti riservati

---

**Built with Rizz** 💪 | Powered by Expo + Supabase
