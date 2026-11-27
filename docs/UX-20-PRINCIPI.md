# 20 principi UX — Skibidi Orders

Audit sull'app cliente (menu, carrello, checkout, home, offerte). La pagina `app/order-tracking*` non è stata modificata: un altro agente ci sta lavorando. Le pizze del menu non hanno animazione di ingresso, così compaiono subito.

| # | Principio | Prima | Cosa è cambiato | File |
| --- | --- | --- | --- | --- |
| 1 | Squash & stretch | mancante | Il "+" del menu si schiaccia in ~160ms; il badge del carrello si deforma quando il conteggio sale | `components/motion/motionParts.tsx`, `components/features/ProductCard.tsx`, `app/(tabs)/menu.tsx` |
| 2 | Anticipation | mancante | Il volo verso il carrello parte dopo 50ms di wind-up; il pulsante "Aggiungi" fa un piccolo passo indietro prima dello stretch | `components/motion/CartFlyProvider.tsx`, `components/motion/useAddToCartMotion.ts` |
| 3 | Staging | mancante | Ingresso a scaglioni su chip categoria (dopo Pizze), offerte e sezioni sotto l'hero. Lista pizze senza delay | `components/motion/motionParts.tsx`, `components/features/MobileCategoryBar.tsx`, `components/features/offers/OffersList.tsx`, `app/(tabs)/index.tsx` |
| 4 | Pose to pose | parziale | Sequenza a fotogrammi sul badge, sul "+" e sulla spunta di ordine confermato (niente più spring aperto) | `components/motion/motionParts.tsx`, `components/motion/useAddToCartMotion.ts`, `app/order-success.tsx` |
| 5 | Follow through | mancante | Il contenuto del foglio carrello e di ogni passo del checkout si assesta di 8px dopo l'apertura | `components/motion/motionParts.tsx`, `app/(tabs)/menu.tsx`, `app/modal.tsx` |
| 6 | Easing, mai lineare | parziale | Le nuove transizioni usano `Easing.out(cubic/quad)` o `Easing.inOut(cubic)`. Il layout delle righe carrello non è più uno spring | `components/features/CartItem.tsx`, `components/motion/CartFlyProvider.tsx` |
| 7 | Arcs | mancante | Puntino dal pulsante "Aggiungi al carrello" fino all'icona in alto, su un arco. Saltato se il movimento è ridotto. Non parte dai +/- | `components/motion/CartFlyProvider.tsx`, `components/features/ProductDetailsModal.tsx`, `components/features/PizzaBuilderModal.tsx` |
| 8 | Secondary action | parziale | La spunta di conferma resta, ma in 260ms con overshoot corto e senza delay che nascondeva il testo | `app/order-success.tsx` |
| 9 | Animazioni UI ≤ 300ms | parziale | Durate nuove sotto i 300ms. `motionDuration` taglia qualunque valore più lungo e vale 0 con reduced motion | `lib/motion/timings.ts` |
| 10 | Feedback esagerato | mancante | Shake sul nome e sul telefono non validi, nel checkout a passi e in quello a schermata unica | `components/motion/motionParts.tsx`, `app/modal.tsx`, `app/one-screen-checkout.tsx` |
| 11 | Depth | parziale | Card prodotto: scala 0.985 e ombra più alta in pressione. Stesso accenno sulle card offerta e sulla riga mobile | `components/features/ProductCard.tsx`, `app/(tabs)/menu.tsx`, `components/features/offers/OfferCard.tsx` |
| 12 | Appeal / loading | già ok | Menu, offerte, cucina e dashboard usano già gli skeleton al posto di uno spinner di pagina. Nessun cambiamento | `components/ui/Skeleton.tsx` |
| 13 | Fitts | parziale | Barra mobile sticky con etichetta "Vai al carrello", altezza minima 72. Checkout a schermata unica: pulsante visibile "Ordina" (nome accessibile invariato) | `app/(tabs)/menu.tsx`, `app/one-screen-checkout.tsx` |
| 14 | Aree di tap ≥ 44 | parziale | `hitSlop` e 44×44 su +/-, cestino gusto, chiudi, indietro, carrello, esci, pulisci ricerca | `app/(tabs)/menu.tsx`, `components/features/ProductCard.tsx`, `app/offers.tsx`, `app/modal.tsx`, `components/features/landing/LandingHeader.tsx`, `components/features/MobileCategoryBar.tsx`, `components/features/MezzoMetroGustiStep.tsx` |
| 15 | Hick | parziale | Nel passo orario resta "Il prima possibile"; gli 8 slot e la rotella stanno dietro "Scegli un altro orario" | `app/modal.tsx` |
| 16 | Miller | parziale | Telefoni a gruppi (`0522 171 7681`, `333 123 4567`) come anteprima. Codici con 5+ cifre spezzati. Totali da €1000 in su in formato `1.234,50`. Sotto €1000 resta `€5.00` | `lib/utils/phone.ts`, `lib/utils/displayFormat.ts`, `app/modal.tsx`, `app/one-screen-checkout.tsx`, `app/order-success.tsx` |
| 17 | Doherty < 400ms | già ok | Il carrello è già stato locale: quantità e totale cambiano nello stesso tap. Aggiunto lo stato premuto immediato sulla barra e su "Procedi al Pagamento" | `lib/stores/CartContext.tsx`, `app/(tabs)/menu.tsx`, `components/features/CartSummary.tsx` |
| 18 | Postel | parziale | Il telefono accetta spazi, trattini e +39 / 0039 e li normalizza. Il nome viene trimmato e gli spazi doppi collassano, in blur e all'invio | `lib/utils/phone.ts`, `lib/utils/displayFormat.ts`, `app/modal.tsx`, `app/one-screen-checkout.tsx` |
| 19 | Jakob | parziale | Icona carrello in alto a destra, sempre visibile, con badge sul conteggio. Indietro su offerte e checkout già presenti, ora con area di tap piena | `app/(tabs)/menu.tsx`, `app/offers.tsx`, `app/modal.tsx` |
| 20 | Frequenza d'uso | parziale | +/− , tab categoria e ricerca non volano e non aspettano uno stagger. Il "+" ha solo il micro-squash; il volo ad arco è sul pulsante di aggiunta del dettaglio | `components/motion/motionParts.tsx`, `app/(tabs)/menu.tsx`, `components/features/MobileCategoryBar.tsx` |

Reduced motion: `useMotionEnabled` legge `AccessibilityInfo.isReduceMotionEnabled` e `useReducedMotion` di reanimated (sul web segue `prefers-reduced-motion`). Il foglio in `app/+html.tsx` azzera anche le animazioni CSS. Se il movimento è ridotto, badge, volo, stagger, shake e assestamento non partono.
