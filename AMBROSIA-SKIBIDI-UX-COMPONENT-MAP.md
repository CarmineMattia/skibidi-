# Ambrosia x Skibidi UX Component Map

## Obiettivo

Unificare il prodotto su una UX chiara per ristoranti/pizzerie:

- **Home Guest (non registrato)**: orientata alla conversione rapida (vedi menu, ordina subito).
- **Home Logged (registrato)**: orientata alla retention (continua ordine, storico, suggeriti).
- **Un solo design language** + **theme per ristorante** (brand color, logo, alcuni accenti), senza duplicare componenti.

---

## Decisione Prodotto (confermata)

1. Usare entrambe le home di Ambrosia come riferimento:
   - `Ambrosia Home Screen` => landing guest
   - `Ambrosia Home` => home utente registrato
2. Mantenere il flow semplice stile fast-food (tipo McDonald's):
   - browse rapido, categorie immediate, CTA visibili
3. Evitare due sistemi UI separati:
   - stessa libreria componenti
   - varia solo il layout/composizione per stato utente (guest vs logged)

---

## Flow Target (v1)

### 1) Guest Flow (ordine rapido)

`Home Guest -> Menu -> Product Details -> Cart -> Checkout -> Success`

Principi:

- hero semplice
- massimo 2 CTA principali above the fold
- scorciatoie a categorie/combos
- no attriti di login prima del primo ordine

CTA prioritarie:

- `Ordina Subito`
- `Vedi Menu`

### 2) Logged Flow (ritorno cliente)

`Home Logged -> Reorder/Continue -> Menu/Cart -> Checkout`

Principi:

- priorita' a "riordina" e "continua ordine"
- suggerimenti personalizzati
- storico e stato ordini in primo piano

Blocchi chiave:

- In voga / consigli chef
- Vicino a te (se multi-tenant/multi-store)
- Storico ordini con `Riordina`

### 3) Admin/Kitchen Flow (operativo)

`Kitchen Board -> Order Detail -> Status Update -> Ready`

Principi:

- densita' informativa alta
- stato ordine immediato
- azioni veloci con feedback chiaro

---

## Component Inventory: Ambrosia vs Skibidi

## Home Guest

- **Ambrosia**
  - Hero with brand
  - Promo blocks
  - Menu discovery
  - Strong CTA area
- **Skibidi attuale**
  - `app/(tabs)/index.tsx`: blocchi combo, categorie, azioni rapide
  - CTA presenti ma non ancora separazione netta guest/logged in layout
- **Gap**
  - Hero guest dedicato con 2 CTA principali
  - Blocco "Best seller / pizze in voga" sopra piega

## Home Logged

- **Ambrosia**
  - Home ricca: suggeriti, storico, sezioni editoriali
- **Skibidi attuale**
  - `app/(tabs)/index.tsx` + `app/(tabs)/two.tsx` condividono parti simili (ordini, categorie, combo)
- **Gap**
  - consolidare in una sola home logged
  - eliminare duplicazioni tra `index` e `two`
  - introdurre "continue order", "chef picks", "near you"

## Menu

- **Ambrosia**
  - card visuali premium, focus discovery
- **Skibidi attuale**
  - `app/(tabs)/menu.tsx`
  - `components/features/ProductCard.tsx`
  - category sidebar/mobile sheet + cart modal
- **Gap**
  - allineare visual hierarchy per guest mode (scoperta) vs power mode (riordino)
  - standardizzare varianti card (default, compact, admin)

## Checkout

- **Ambrosia**
  - summary ordinato, breakdown costi, CTA finale molto forte
- **Skibidi attuale**
  - cart summary e modal checkout presenti nel flow menu/modal
- **Gap**
  - unificare "cart + checkout step" come pattern unico e piu' leggibile
  - migliorare blocco "service fee / totale / dine in-takeaway"

## Kitchen/Admin

- **Ambrosia**
  - status board con semafori e filtri
- **Skibidi attuale**
  - `app/(tabs)/kitchen.tsx` + `KitchenOrderCard`
- **Gap**
  - visual consistency col resto del sistema
  - rafforzare pattern badge + timer + CTA stato

---

## Architettura UI consigliata: 1 Stile + Theme

## A) Design Tokens Base (global)

- color semantiche: `bg`, `surface`, `text`, `primary`, `success`, `warning`, `danger`
- typography scale unica
- spacing scale unica
- radius scale unica
- elevation/shadow unica

Questi token non dipendono dal ristorante.

## B) Tenant Theme Overrides (per ristorante)

Override minimi per mantenibilita':

- `brand.primary`
- `brand.secondary` (opzionale)
- `logo`
- `heroImage` (opzionale)
- `accentPattern` (opzionale leggero)

No override su layout, spacing e comportamento componenti.

## C) Component Variants (non fork)

Stesso componente, varianti controllate:

- `ProductCard`: `default | compact | featured`
- `OrderCard`: `history | active | kitchen`
- `SectionHeader`: `plain | withLink | withBadge`
- `PrimaryCTA`: `filled | elevated`

---

## Mapping tecnico su codice attuale

File principali impattati:

- `app/(tabs)/index.tsx`
- `app/(tabs)/two.tsx`
- `app/(tabs)/menu.tsx`
- `components/features/ProductCard.tsx`
- `app/(tabs)/_layout.tsx`

Refactor suggerito:

1. estrarre blocchi home in componenti:
   - `HomeGuestHero`
   - `HomeGuestQuickActions`
   - `HomeLoggedReorder`
   - `HomeLoggedRecommendations`
   - `HomeLoggedHistoryPreview`
2. ridurre duplicazione con `two.tsx`:
   - lasciare `two` come pagina "Ordini" completa
   - usare su home solo preview 2-3 items
3. introdurre `useHomeSections(userState)`:
   - decide ordine e presenza sezioni per guest/logged/admin

---

## MVP Backlog (ordine pratico)

1. **Split Home Guest/Logged in `index.tsx`**
2. **Hero Guest con 2 CTA**
3. **Logged Home con 3 blocchi fissi**
   - Continua ordine / Riordina
   - In voga (Chef picks)
   - Storico rapido
4. **Allineamento visuale `ProductCard` + CTA**
5. **Pulizia `two.tsx` (solo ordini, no duplicati home)**
6. **Theme binding da `TenantContext` ai token UI**

---

## Regola UX chiave

Per coerenza con idea "Skibidi stile fast-food":

- ogni schermata deve avere **1 azione primaria evidente**
- massimo **2 azioni competenti** per viewport mobile
- ridurre testo superfluo
- sempre "ordine veloce" raggiungibile in 1 tap dalla home guest

