# Backend Checkout Integration - Complete Guide

## ✅ What Was Built

Created the complete backend infrastructure for order creation and management in the SKIBIDI ORDERS POS system.

---

## 📦 New Files Created**

### 1. **`lib/hooks/useCreateOrder.ts`**
TanStack Query mutation hook for creating orders.

**Features:**
- ✅ Creates order with order_items in two-step transaction
- ✅ Supports authenticated and anonymous (kiosk) users
- ✅ Automatic rollback if order_items insertion fails
- ✅ Proper TypeScript typing with Supabase generated types
- ✅ Error handling with Italian user-friendly messages
- ✅ Automatic cache invalidation on success

**Usage Example:**
```tsx
import { useCreateOrder } from '@/lib/hooks';
import { useCart } from '@/lib/stores/CartContext';
import { useRouter } from 'expo-router';

function CheckoutButton() {
  const { items, clearCart } = useCart();
  const router = useRouter();
  const createOrder = useCreateOrder();

  const handleCheckout = async () => {
    try {
      const result = await createOrder.mutateAsync({
        items,
        notes: 'Ordine da kiosk',
      });

      // Clear cart on success
      clearCart();

      // Navigate to success screen
      router.push('/order-success');

      console.log('Order created:', result.orderId);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile creare l\'ordine. Riprova.');
    }
  };

  return (
    <Button
      onPress={handleCheckout}
      disabled={createOrder.isPending}
    >
      {createOrder.isPending ? 'Creazione...' : 'Conferma Ordine'}
    </Button>
  );
}
```

---

### 2. **`lib/hooks/useOrders.ts`**
TanStack Query hooks for fetching user order history.

**Two Hooks Provided:**

#### `useOrders(options)` - Fetch multiple orders
```tsx
import { useOrders } from '@/lib/hooks';

function OrderHistoryScreen() {
  // Fetch all orders
  const { data: orders, isLoading } = useOrders();

  // Fetch only pending orders
  const { data: pendingOrders } = useOrders({ status: 'pending' });

  // Fetch with limit
  const { data: recentOrders } = useOrders({ limit: 10 });

  if (isLoading) return <ActivityIndicator />;

  return (
    <FlatList
      data={orders}
      renderItem={({ item }) => (
        <View>
          <Text>Order #{item.id.slice(0, 8)}</Text>
          <Text>Total: €{item.total_amount.toFixed(2)}</Text>
          <Text>Status: {item.status}</Text>
          <Text>Items: {item.order_items.length}</Text>
        </View>
      )}
    />
  );
}
```

#### `useOrder(orderId)` - Fetch single order
```tsx
import { useOrder } from '@/lib/hooks';

function OrderDetailScreen({ orderId }: { orderId: string }) {
  const { data: order, isLoading } = useOrder(orderId);

  if (isLoading) return <ActivityIndicator />;

  return (
    <View>
      <Text>Order #{order.id}</Text>
      {order.order_items.map((item) => (
        <View key={item.id}>
          <Text>{item.product.name}</Text>
          <Text>Qty: {item.quantity}</Text>
          <Text>€{item.total_price.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );
}
```

---

### 3. **`types/database.types.generated.ts`**
Official Supabase TypeScript types generated from the database schema.

**Includes:**
- Full `Database` type with all tables, views, functions, enums
- `Tables<>`, `TablesInsert<>`, `TablesUpdate<>` helper types
- `Enums<>` type for database enums
- Proper PostgreSQL type mappings

**Updated Files:**
- `types/database.types.ts` - Now re-exports from generated file
- `lib/api/supabase.ts` - Now uses generated Database type
- `lib/hooks/index.ts` - Exports new hooks

---

## 🗃️ Database Schema (Already Implemented)

### `orders` Table
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES auth.users(id),  -- NULL for anonymous kiosk orders
  status order_status DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  fiscal_status fiscal_status DEFAULT 'pending',
  fiscal_external_id TEXT,
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `order_items` Table
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Enums
```sql
CREATE TYPE order_status AS ENUM (
  'pending', 'preparing', 'ready', 'delivered', 'cancelled'
);

CREATE TYPE fiscal_status AS ENUM (
  'pending', 'success', 'error'
);
```

---

## 🔒 Row Level Security (RLS) Policies

**Current Status:** ✅ Policies allow public access for MVP

### Orders Table Policies:
- `public_read_orders` - Anyone can read orders
- `public_write_orders` - Anyone can create/update orders

### Order Items Table Policies:
- `public_read_order_items` - Anyone can read order items
- `public_write_order_items` - Anyone can create/update order items

**Note:** These permissive policies are temporary for MVP development. In production, you should implement proper RLS:

```sql
-- Example: Restrict to authenticated users
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'kiosk')
    )
  );
```

---

## 🔗 How to Integrate with Frontend

### Step 1: Update menu.tsx Checkout Handler

Edit `app/(tabs)/menu.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { useCreateOrder } from '@/lib/hooks';
import { Alert } from 'react-native';

export default function MenuScreen() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const createOrder = useCreateOrder();

  const handleCheckout = async () => {
    if (items.length === 0) {
      Alert.alert('Carrello vuoto', 'Aggiungi prodotti prima di procedere.');
      return;
    }

    try {
      const result = await createOrder.mutateAsync({
        items,
        notes: undefined, // Optional order notes
      });

      console.log('✅ Order created successfully:', result.orderId);

      // Clear cart
      clearCart();

      // Navigate to success screen
      router.push('/order-success');
    } catch (error) {
      console.error('❌ Order creation failed:', error);
      Alert.alert(
        'Errore',
        'Impossibile creare l\'ordine. Riprova tra poco.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View className="flex-1 flex-row">
      {/* ... existing code ... */}

      {/* Right Sidebar - Cart */}
      <View className="w-[380px]">
        <CartSummary onCheckout={handleCheckout} />
      </View>
    </View>
  );
}
```

### Step 2: Update CartSummary Component

The `onCheckout` prop is already there! Just make sure the button shows loading state:

```tsx
// In components/features/CartSummary.tsx (already exists)
interface CartSummaryProps {
  onCheckout?: () => void;
  isCheckingOut?: boolean; // Add this prop
}

export function CartSummary({ onCheckout, isCheckingOut }: CartSummaryProps) {
  return (
    <Pressable
      className="bg-primary rounded-2xl p-5"
      onPress={onCheckout}
      disabled={isCheckingOut}
      style={{ opacity: isCheckingOut ? 0.5 : 1 }}
    >
      <Text className="text-primary-foreground font-extrabold text-xl">
        {isCheckingOut ? 'Elaborazione...' : 'Procedi al Pagamento'}
      </Text>
    </Pressable>
  );
}
```

### Step 3: Update Success Screen with Real Order ID

Edit `app/order-success.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';

export default function OrderSuccessScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  // Use the real order ID instead of random number
  const displayOrderId = orderId ? orderId.slice(0, 8) : 'N/A';

  return (
    <View>
      <Text>Ordine Confermato!</Text>
      <Text>Il tuo ordine #{displayOrderId.toUpperCase()} è in preparazione.</Text>
    </View>
  );
}
```

Then in checkout, navigate with orderId:
```tsx
router.push(`/order-success?orderId=${result.orderId}`);
```

---

## 🧪 Testing the Backend

### Test 1: Create Order (Anonymous Kiosk Mode)

```tsx
// In any component or screen
const createOrder = useCreateOrder();

const testOrder = async () => {
  try {
    const result = await createOrder.mutateAsync({
      items: [
        {
          product: {
            id: 'product-uuid-here',
            name: 'Hamburger Classico',
            price: 8.50,
            // ... other product fields
          },
          quantity: 2,
          notes: 'Senza cipolle',
        },
      ],
      notes: 'Test order from kiosk',
    });

    console.log('✅ Success:', result);
    // Output: { orderId: 'uuid...', totalAmount: 17.00, fiscalStatus: 'pending' }
  } catch (error) {
    console.error('❌ Failed:', error);
  }
};
```

### Test 2: Fetch Orders

```tsx
// Requires authenticated user
const { data: orders, error } = useOrders();

if (error) {
  console.error('Failed to fetch orders:', error);
} else {
  console.log(`Found ${orders.length} orders`);
  orders.forEach((order) => {
    console.log(`- Order ${order.id}: €${order.total_amount}`);
  });
}
```

### Test 3: Verify in Supabase Dashboard

1. Go to Supabase Dashboard → Table Editor
2. Check `orders` table - you should see new order
3. Check `order_items` table - you should see related items
4. Verify `fiscal_status` is 'pending' (will be updated in Fase 3)

---

## 📊 Data Flow

```
User clicks "Procedi al Pagamento"
       ↓
handleCheckout() called
       ↓
useCreateOrder.mutateAsync({ items, notes })
       ↓
1. Get current user (auth.getUser())
2. Calculate total amount
3. Insert into orders table → Get order.id
4. Insert into order_items table (bulk)
5. If error → Rollback (delete order)
       ↓
Success: { orderId, totalAmount, fiscalStatus }
       ↓
Clear cart + Navigate to /order-success
       ↓
Show success animation with order ID
```

---

## 🚀 Next Steps (Fase 3 - Fiscal Integration)

Once orders are working, you can implement:

1. **Fiscal Service Layer** (`lib/fiscal/`)
   - `IFiscalProvider` interface
   - `CloudApiProvider` implementation (mock or real API)
   - Queue system for failed fiscalization

2. **Update Order Status**
   - Create `useUpdateOrderStatus` hook
   - Update `fiscal_status` after successful fiscalization
   - Store `fiscal_external_id` and `pdf_url`

3. **Realtime Kitchen View** (Fase 4)
   - Subscribe to order changes with Supabase Realtime
   - Auto-refresh kitchen dashboard
   - Order status transitions (pending → preparing → ready → delivered)

---

## ✅ Checklist

- [x] `useCreateOrder` hook created
- [x] `useOrders` query hook created
- [x] `useOrder` single order hook created
- [x] TypeScript types generated from Supabase
- [x] Supabase client properly typed
- [x] RLS policies verified (currently permissive for MVP)
- [x] Hooks exported from `lib/hooks/index.ts`
- [x] Error handling with Italian messages
- [x] Rollback mechanism for failed transactions
- [x] Cache invalidation on success
- [x] TypeScript compilation passes (0 errors)

---

## 📝 Notes

- **Anonymous Orders**: Currently supported by allowing `customer_id` to be NULL
- **Price Handling**: Using DECIMAL(10, 2) in DB (recommended) but JavaScript numbers for now
  - Future: Migrate to integer cents for calculations (€8.50 → 850 cents)
- **Transaction Safety**: Manual rollback implemented (delete order if items fail)
  - Future: Use Supabase Edge Functions for true ACID transactions
- **Fiscal Status**: Defaults to 'pending', will be updated in Fase 3

---

**🎉 Backend checkout infrastructure is complete and ready for integration!**
