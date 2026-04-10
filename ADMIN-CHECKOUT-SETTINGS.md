# Admin Checkout Settings

This project now supports two checkout settings configurable by admins:

## 1) Checkout Language
- Supported values: `it`, `en`
- Purpose: controls checkout labels and messages (`/modal`)
- UI location: `app/admin-options.tsx` ("Lingua / Language")
- Persistence key: `skibidi_admin_language`

## 2) Delivery Fee (EUR)
- Numeric value (>= 0), default `2.00`
- Applied only when `order_type = delivery`
- Effects:
  - shown in checkout summary (`subtotal + delivery fee = total`)
  - included in order total saved to DB
  - included in fiscal total calculation
- UI location: `app/admin-options.tsx` ("Costo delivery")
- Persistence key: `skibidi_delivery_fee_eur`

## Context Provider
- File: `lib/stores/AppSettingsContext.tsx`
- Exposed hook: `useAppSettings()`
- Wrapped globally in: `app/_layout.tsx`

## Payment rules implemented
- Delivery: only `Credit Card` and `Cash`
- `POS at counter` is hidden for delivery
- Cash subtitle for delivery is "Pay on delivery"
- Eat-in / Take-away keep all methods (including POS)
