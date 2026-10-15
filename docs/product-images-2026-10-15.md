# Controllo immagini prodotti (2026-10-15)

Prodotti attivi letti da prod in sola lettura (solo `select`): **85**, tutti in categorie attive.
Immagine effettiva = foto locale di `lib/data/pizzaPhotos.ts` (stesso id e stessa ricetta),
altrimenti `products.image_url` controllata via HTTP.

**Risultato:** nessun URL rotto. 74 prodotti hanno un'immagine funzionante: 48 con foto locale
(file presente) e 26 con `image_url` che risponde 200 `image/*`. **11 prodotti non hanno immagine** (`image_url` null e nessuna foto locale):

| Categoria | Prodotto |
|---|---|
| Al metro | Farcita |
| Al metro | Gourmet |
| Al metro | Margherita |
| Al metro | Metà Margherita Metà Farcita |
| Al metro | Super Farcita |
| Bianche | Stria |
| Dolci | Profiterol |
| Dolci | Sorbetto al Limone |
| Dolci | Tartufo Bianco / Nero |
| Dolci | Tiramisù |
| Dolci | Torroncino |

Per questi servono foto (vere o generate come le altre `*-generated-v1.webp`): decisione di Carmine.
Nessuna modifica al DB è necessaria, quindi nessuna migration.

Ripetere il controllo: `node scripts/check-product-images.mjs products.json` (export JSON dei
prodotti attivi; lo script non si collega al DB).
