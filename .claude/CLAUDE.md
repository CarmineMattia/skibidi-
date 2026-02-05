# Development Guidelines - SKIBIDI ORDERS

This document contains critical information about working with this POS system codebase. Follow these guidelines precisely.

## Project Overviewp

Sistema POS proprietario per ristorazione che unifica l'esperienza Consumatore (Web/Mobile) e Gestore/Totem (App Nativa Kiosk). Gestisce ordini, pagamenti e fiscalità italiana tramite comunicazione diretta con Registratori Telematici (RT) Epson.

**Filosofia**: API-First per iniziare (MVP), ma pronto per diventare Offline-First in futuro.

## Core Development Rules

### 1. Package Management
- ONLY use `npm`, NEVER `yarn` or `pnpm`
- Installation: `npm install package`
- Dev dependencies: `npm install --save-dev package`
- Running scripts: `npm run script-name`
- **FORBIDDEN**: Mix di package managers, installazioni globali senza necessità

### 2. TypeScript Strict Mode
- **Type safety is non-negotiable**
- All files must be TypeScript (`.ts`, `.tsx`)
- Strict mode enabled (`tsconfig.json`)
- Required rules:
  - No `any` types (use `unknown` + type guards)
  - Explicit return types for public functions
  - No non-null assertions (`!`) without justification
  - Proper type imports: `import type { Type } from '...'`

### 3. Code Organization
- **Component structure**:
  ```tsx
  // 1. Imports (grouped: React, third-party, local)
  // 2. Types/Interfaces
  // 3. Component definition
  // 4. Exports
  ```
- **File naming**:
  - Components: `PascalCase.tsx` (e.g., `ProductCard.tsx`)
  - Utilities/hooks: `camelCase.ts` (e.g., `useCart.ts`)
  - Types: `kebab-case.types.ts` (e.g., `database.types.ts`)
- **Folder structure**: Follow feature-based architecture (see ARCHITECTURE.md)

### 4. Styling with NativeWind
- **ALWAYS use NativeWind classes**, never StyleSheet.create
- Use design system tokens (see `global.css` variables)
- Proper class application:
  ```tsx
  // ✅ CORRECT
  <View className="flex-1 bg-background p-4">

  // ❌ WRONG
  <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
  ```
- Complex styles: Use `cn()` utility for conditional classes
- Responsive design: Use Tailwind breakpoints when targeting web

### 5. State Management Rules
- **Server state**: TanStack Query (`useQuery`, `useMutation`)
- **Client state**: React Context (Cart, UI preferences)
- **Form state**: Controlled components + validation
- **NEVER**: Redux, MobX, Zustand (not needed for this project)

### 6. Database & API
- **All Supabase queries** must use TypeScript types from `types/database.types.ts`
- **Row Level Security (RLS)**: Respect policies, don't bypass
- **Realtime subscriptions**: Clean up on unmount
- **Error handling**: Always handle `.error` from Supabase responses
  ```tsx
  const { data, error } = await supabase.from('products').select();
  if (error) {
    console.error('Database error:', error);
    // Handle appropriately
  }
  ```

## React Native / Expo Specific

### 1. Navigation (Expo Router)
- File-based routing: files in `app/` become routes
- Use `<Link>` for navigation, not `router.push()` unless necessary
- Layout files (`_layout.tsx`) for nested navigation
- Group routes with `(groupName)` folders

### 2. Platform-Specific Code
```tsx
import { Platform } from 'react-native';

// Check platform
if (Platform.OS === 'web') {
  // Web-only code
}

// Or use Platform.select
const fontSize = Platform.select({
  web: 16,
  android: 14,
  ios: 15,
});
```

### 3. Assets
- Images: Use `require()` for local, URI for remote
- Fonts: Load via `expo-font` in root layout
- Icons: Prefer `@expo/vector-icons` or Lucide React Native

### 4. Performance
- **Memoization**: Use `React.memo()`, `useMemo()`, `useCallback()` appropriately
- **FlatList**: For long lists (menu items), never `.map()`
- **Image optimization**: Use `expo-image` for caching
- **Bundle size**: Import only needed parts (`import { Button } from '@/components/ui'`)

## Testing Requirements

### 1. Unit Tests (Future)
- Framework: Jest + React Testing Library
- File naming: `ComponentName.test.tsx`
- Coverage targets:
  - Business logic: 80%+
  - UI components: 60%+
  - Utilities: 90%+

### 2. E2E Tests (Future - Fase 4+)
- Framework: Detox (mobile) or Playwright (web)
- Critical flows to test:
  - Order creation (end-to-end)
  - Payment processing
  - Fiscal receipt generation
  - Kitchen order reception

## Git Workflow

### 1. Commits
- **Format**: Conventional Commits
  ```
  feat(menu): add product filtering by category
  fix(cart): resolve quantity update bug
  docs(readme): update setup instructions
  ```
- **Scope**: `menu`, `cart`, `orders`, `fiscal`, `auth`, `ui`, `db`
- **Trailers** (when applicable):
  ```bash
  git commit --trailer "Fixes:#123"
  git commit --trailer "Reported-by:Mario Rossi"
  ```
- **Co-authored-by**: Include for AI assistance
  ```
  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  ```

### 2. Branches
- `main`: Production-ready code
- `develop`: Integration branch
- Feature branches: `feature/menu-filtering`, `fix/cart-bug`
- **NEVER push directly to main**

### 3. Pull Requests
- **Title**: Clear, descriptive (e.g., "Implement product filtering in menu")
- **Description template**:
  ```markdown
  ## Summary
  - What problem does this solve?
  - High-level approach

  ## Changes
  - Bullet list of key changes

  ## Testing
  - [ ] Tested on web
  - [ ] Tested on Android
  - [ ] Tested with offline mode (if applicable)

  ## Screenshots/Video
  (if UI changes)
  ```

## Code Quality Standards

### 1. ESLint & Prettier
- **NEVER disable rules** without team discussion
- Config files: `.eslintrc.js`, `.prettierrc`
- Format on save: Enabled in VSCode
- Pre-commit hook: Runs linting + formatting

### 2. Code Review Checklist
Before submitting PR:
- [ ] TypeScript errors: `npx tsc --noEmit`
- [ ] Linting: `npm run lint` (or ESLint check)
- [ ] No console.logs (use proper logging)
- [ ] Accessibility: Labels, semantic components
- [ ] Performance: No unnecessary re-renders
- [ ] Security: No hardcoded secrets, proper RLS

### 3. Component Best Practices
```tsx
// ✅ GOOD Component
interface ProductCardProps {
  product: Product;
  onPress: (id: string) => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const handlePress = useCallback(() => {
    onPress(product.id);
  }, [product.id, onPress]);

  return (
    <Pressable
      className="bg-card rounded-lg p-4"
      onPress={handlePress}
    >
      <Text className="text-card-foreground font-semibold">
        {product.name}
      </Text>
      <Text className="text-muted-foreground">
        €{product.price.toFixed(2)}
      </Text>
    </Pressable>
  );
}

// ❌ BAD Component
export default ({ product, onPress }) => { // No types!
  return (
    <Pressable style={{ padding: 16 }} onPress={() => onPress(product.id)}>
      <Text>{product.name}</Text> {/* No styling */}
    </Pressable>
  );
}
```

## Security & Fiscal Compliance

### 1. Fiscal Requirements (Critical - Legge Italiana)
- **OGNI ordine** deve essere fiscalizzato (RT Epson o Cloud API)
- **Queue system**: Se la fiscalizzazione fallisce, salvare in coda per retry
- **Logging**: Mantenere audit trail completo di tutte le operazioni fiscali
- **Timestamp**: Usare timestamp server-side (Supabase) per ordini
- **GDPR**: Dati clienti anonimi per ordini kiosk

### 2. Environment Variables
- **NEVER commit** `.env` file
- Always update `.env.example` when adding new vars
- Supabase keys:
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: OK to expose (protected by RLS)
  - `SUPABASE_SERVICE_ROLE_KEY`: NEVER in client code

### 3. Data Validation
- **Client-side**: UI feedback (React Hook Form + Zod)
- **Server-side**: Database constraints + RLS policies
- **Never trust client input** for fiscal/payment operations

## Error Handling

### 1. User-Facing Errors
```tsx
try {
  const result = await createOrder(cartItems);
} catch (error) {
  // Log for debugging
  console.error('Order creation failed:', error);

  // Show user-friendly message
  Alert.alert(
    'Errore',
    'Impossibile creare l\'ordine. Riprova.',
    [{ text: 'OK' }]
  );
}
```

### 2. Background Errors
- Use error boundaries for React crashes
- Sentry integration (Future): Track crashes in production

### 3. Network Errors
- **Offline mode**: Show clear indicator
- **Retry logic**: TanStack Query handles retries automatically
- **Fallback**: Local queue for critical operations (orders)

## Performance Monitoring

### 1. Development
- **React DevTools**: Check re-renders
- **Expo Dev Client**: Monitor bundle size
- **Network tab**: Check API call efficiency

### 2. Production (Future)
- **Expo Analytics**: Track crashes, performance
- **Supabase Dashboard**: Monitor DB query performance
- **Custom metrics**: Order completion time, fiscal API latency

## Documentation Requirements

### 1. Code Documentation
- **Public APIs**: JSDoc comments with examples
- **Complex logic**: Inline comments explaining "why", not "what"
- **Types**: Self-documenting with good naming

### 2. Project Documentation
- **README.md**: Getting started, overview
- **SETUP-GUIDE.md**: Detailed setup instructions
- **ARCHITECTURE.md**: Technical architecture
- **ROADMAP.md**: Feature planning and phases

## Specific Domain Rules

### 1. E-commerce / POS
- **Prices**: ALWAYS use integers (cents) for calculations, display formatted
  ```tsx
  // ✅ CORRECT
  const priceInCents = 850; // €8.50
  const display = `€${(priceInCents / 100).toFixed(2)}`;

  // ❌ WRONG
  const price = 8.50; // Floating point errors!
  ```
- **Currency**: All prices in EUR (€)
- **VAT**: Italian IVA rates (22%, 10%, 4%)

### 2. Fiscal Integration (Fase 3+)
- **Adapter Pattern**: Abstraction layer for different providers
- **Timeout handling**: RT Epson può essere lento, non bloccare UI
- **Failure handling**: Queue + manual retry UI
- **Receipt storage**: PDF URL + metadata in database

### 3. Realtime (Fase 4+)
- **Supabase subscriptions**: Kitchen view updates
- **Cleanup**: Always unsubscribe on component unmount
- **Reconnection**: Handle connection drops gracefully

## Common Patterns

### 1. Data Fetching
```tsx
// Use TanStack Query
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/api/supabase';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('active', true);

      if (error) throw error;
      return data;
    },
  });
}
```

### 2. Form Handling (Future)
```tsx
// Use controlled components
const [name, setName] = useState('');
const [price, setPrice] = useState('');

// Validation before submit
const handleSubmit = () => {
  if (!name.trim()) return;
  if (parseFloat(price) <= 0) return;
  // ...
};
```

### 3. Context Usage
```tsx
// Cart context (Future - Fase 2)
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
```

## Prohibited Practices

### ❌ NEVER DO THIS
1. **Bypass TypeScript**: `// @ts-ignore`, excessive `as any`
2. **Hardcode values**: API URLs, credentials, configuration
3. **Mutate props**: Props are immutable
4. **Use index as key**: `key={index}` in lists
5. **Skip error handling**: Every API call needs error handling
6. **Disable RLS**: Security non negoziabile
7. **Mix styling**: StyleSheet + NativeWind insieme
8. **Commit secrets**: `.env`, API keys, passwords

## Development Workflow

1. **Start development server**: `npm start`
2. **Check types**: `npx tsc --noEmit` (before commits)
3. **Format code**: Auto-format on save (VSCode)
4. **Test locally**: Web + Android/iOS
5. **Commit**: Conventional format + type check pass
6. **Push**: Create PR, request review

## Questions & Support

- **Architecture questions**: Check `ARCHITECTURE.md`
- **Setup issues**: See `SETUP-GUIDE.md`
- **Roadmap**: Reference `roadmap.md`
- **Expo docs**: https://docs.expo.dev
- **Supabase docs**: https://supabase.com/docs
- **NativeWind docs**: https://www.nativewind.dev

---

**Remember**: Questo è un sistema che gestisce denaro e fiscalità. La qualità del codice e la sicurezza sono priorità assolute.

**Built with Rizz** 💪 | **Zero Compromises on Quality**
