# 🏗️ SKIBIDI ORDERS - Architettura

## Overview

Sistema POS per ristorazione costruito con architettura moderna e scalabile.

## Stack Tecnologico Dettagliato

### Frontend
- **React Native 0.81**: Cross-platform mobile framework
- **Expo SDK 54**: Managed workflow per development rapido
- **Expo Router v6**: File-based routing (Tabs + Stack navigation)
- **TypeScript 5.9**: Type safety con strict mode

### Styling & UI
- **NativeWind v4**: Tailwind CSS per React Native
- **Tailwind CSS 3.3**: Utility-first CSS framework
- **Class Variance Authority**: Gestione varianti componenti
- **Design System**: Custom shadcn/ui-inspired con CSS variables

### State Management & Data
- **TanStack Query v5**: Server state management e caching
  - Configurato con retry logic
  - Cache time ottimizzato per POS (5min stale, 10min gc)
- **React Context**: Client-side state (cart, user preferences)
- **Supabase Realtime**: Live updates per ordini cucina

### Backend & Database
- **Supabase**: Backend-as-a-Service
  - PostgreSQL database
  - Auth con RLS (Row Level Security)
  - Realtime subscriptions
  - Edge Functions (future)

## Architettura Dati

### Database Schema

```
┌─────────────┐
│  profiles   │ (extends auth.users)
├─────────────┤
│ id          │ UUID (PK, FK → auth.users)
│ role        │ ENUM (admin, customer, kiosk)
│ email       │ TEXT
│ full_name   │ TEXT
└─────────────┘

┌──────────────┐         ┌──────────────┐
│  categories  │←────┐   │   products   │
├──────────────┤     └───┤──────────────┤
│ id           │         │ id           │
│ name         │         │ category_id  │ FK
│ description  │         │ name         │
│ display_order│         │ price        │
│ active       │         │ image_url    │
└──────────────┘         │ active       │
                         │ display_order│
                         └──────────────┘
                                │
                                │
┌──────────────┐         ┌──────────────┐
│    orders    │←────────│ order_items  │
├──────────────┤         ├──────────────┤
│ id           │         │ id           │
│ customer_id  │ FK      │ order_id     │ FK
│ status       │ ENUM    │ product_id   │ FK
│ total_amount │         │ quantity     │
│ fiscal_status│ ENUM    │ unit_price   │
│ fiscal_ext_id│         │ total_price  │
│ pdf_url      │         └──────────────┘
└──────────────┘
```

### Enums

```typescript
type UserRole = 'admin' | 'customer' | 'kiosk';
type FiscalStatus = 'pending' | 'success' | 'error';
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
```

## Struttura Cartelle (Feature-Based)

```
app/                          # Expo Router (file-based routing)
├── (tabs)/                   # Tab navigation group
│   ├── index.tsx            # Home/Menu screen
│   ├── two.tsx              # Placeholder tab
│   └── _layout.tsx          # Tabs layout
├── modal.tsx                # Example modal
├── +not-found.tsx           # 404 screen
├── +html.tsx                # Web HTML customization
└── _layout.tsx              # Root layout (providers)

components/
├── ui/                      # Base UI components (atomic)
│   ├── Button.tsx          # Reusable button with variants
│   ├── Card.tsx            # Card component family
│   └── index.ts            # Barrel export
└── features/               # Feature-specific components
    └── (future: ProductCard, CartItem, OrderList, etc.)

lib/
├── api/                    # Backend integration
│   ├── supabase.ts        # Supabase client config
│   └── QueryProvider.tsx  # TanStack Query setup
├── fiscal/                # Fiscal integration (Fase 3+)
│   └── (future: RT Epson TCP/HTTP)
├── hooks/                 # React custom hooks
│   └── (future: useCart, useOrders, etc.)
├── stores/                # Context providers
│   └── (future: CartContext, AuthContext)
└── utils/                 # Utility functions
    └── cn.ts              # Class merge utility

types/
├── database.types.ts      # Database schema types
└── index.ts               # Barrel export
```

## Data Flow

### Order Creation Flow (Future - Fase 2-3)

```
User Action (Kiosk)
    ↓
Cart Context (local state)
    ↓
TanStack Query Mutation
    ↓
Supabase Insert (orders + order_items)
    ↓ (on success)
Fiscal Service Layer
    ├─→ Cloud API (Fase 3)
    └─→ Local RT Epson (Fase 5 - offline)
    ↓
Database Update (fiscal_status)
    ↓
Realtime Subscription
    ↓
Kitchen Dashboard (live update)
```

## Security

### Row Level Security (RLS)

Tutte le tabelle hanno RLS abilitato:

**Profiles**
- Lettura: tutti
- Update: solo il proprio profilo
- Admin: full access

**Products/Categories**
- Lettura: tutti (se active OR authenticated)
- Write: solo admin

**Orders**
- Lettura: solo i propri ordini (o admin/kiosk)
- Create: authenticated users
- Update: solo admin/kiosk

**Order Items**
- Lettura: solo se sei owner dell'ordine (o admin/kiosk)
- Create: authenticated users

### Environment Variables

Credenziali sensibili in `.env` (gitignored):
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

## Performance Optimizations

### Caching Strategy (TanStack Query)
- **staleTime**: 5 minuti (menu items raramente cambiano)
- **gcTime**: 10 minuti (keep in cache)
- **retry**: 3 tentativi con exponential backoff
- **Prefetching**: (future) menu al login

### Database Indexes
- Prodotti: `category_id`, `active`
- Ordini: `customer_id`, `status`, `fiscal_status`
- Order Items: `order_id`, `product_id`

### Bundle Size
- NativeWind: only used utilities (purge CSS)
- Tree-shaking: ES modules con barrel exports
- Code splitting: Expo Router lazy loading

## Scalability Considerations

### Backend (Supabase)
- PostgreSQL: scales verticalmente fino a 16 CPU
- Connection pooling: Supavisor (built-in)
- Realtime: WebSocket auto-scaling
- Future: Edge Functions per business logic complessa

### Offline-First (Fase 5)
- Local SQLite: WatermelonDB
- Sync Queue: background jobs
- Conflict Resolution: last-write-wins + timestamps

### Multi-tenant (Future)
- `restaurant_id` su tutte le tabelle
- RLS policies per tenant isolation
- Supabase Organizations per gestione

## Testing Strategy (Future Fasi)

### Unit Tests
- Jest per business logic
- React Testing Library per componenti

### Integration Tests
- Detox per E2E mobile
- Playwright per web

### API Tests
- Supabase local development
- Seed data scripts

## Deployment

### Mobile
- **Expo Updates**: OTA updates per JS changes
- **EAS Build**: Native builds (Android APK/AAB, iOS IPA)
- **EAS Submit**: Auto-upload agli stores

### Web
- Static export: `npx expo export:web`
- Hosting: Vercel/Netlify
- PWA support: service workers

## Monitoring & Observability (Future)

- Sentry: Error tracking
- Supabase Dashboard: Database queries, auth logs
- Custom analytics: Posthog/Mixpanel

## Roadmap Integration

Questa architettura supporta tutte le fasi del roadmap:

- ✅ **Fase 1**: Scaffolding e infrastruttura
- 🔜 **Fase 2**: Menu & Cart (React Context + TanStack Query)
- 🔜 **Fase 3**: Fiscal Cloud API (Adapter Pattern)
- 🔜 **Fase 4**: Realtime Kitchen View (Supabase subscriptions)
- 🔜 **Fase 5**: Offline-First (WatermelonDB + sync queue)

---

**Architettura progettata per scalare** 🚀
