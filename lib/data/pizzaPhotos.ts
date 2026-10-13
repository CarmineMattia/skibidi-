import { Asset } from 'expo-asset';
import type { Product } from '@/types';

// Recipe-specific illustrative photos. Exact product ids and descriptions
// prevent matching another tenant or a changed recipe by pizza name alone.
const PHOTOS: Record<string, { name: string; category: string; recipe: string; asset: number }> = {
  "4eaf1dc3-1b0a-b1f7-8206-8a89b69c5729": { name: "La Rustica", category: "Gourmet", recipe: "mozz.fior di latte, pancetta, stracchino, patate al forno", asset: require("../../assets/images/products/la-rustica-generated-v1.webp") },
  "7758ee2c-0404-8d96-079e-d94d5c65b220": { name: "La Zuccotta", category: "Gourmet", recipe: "crema di zucca, mozz.fior di latte, gorgonzola, pancetta, pepe nero", asset: require("../../assets/images/products/la-zuccotta-generated-v1.webp") },
  "7bbdfd63-3bbe-eaf1-2025-5be3178dcc6e": { name: "Ambrosia", category: "Gourmet", recipe: "mozz. di bufala, pomodorini, pesto alla genovese", asset: require("../../assets/images/products/ambrosia-generated-v1.webp") },
  "0660b53c-4621-173d-3dfd-0322f1589119": { name: "Carbonara", category: "Gourmet", recipe: "mozz. di bufala, pancetta, uovo, pepe nero", asset: require("../../assets/images/products/carbonara-generated-v1.webp") },
  "25b3b1a9-9892-80b3-ab42-c7eb687ab48f": { name: "Crudo e Burrata", category: "Gourmet", recipe: "pomodoro, mozz.fior di latte, fuori cottura: crudo di Parma, burrata Pugliese, olio", asset: require("../../assets/images/products/crudo-e-burrata-generated-v1.webp") },
  "c4cc87ed-28c9-017d-eca3-12c08d01776a": { name: "Cantabrico", category: "Gourmet", recipe: "pomodoro, mozz.fior di latte, fuori cottura: acciughe del mar Cantabrico", asset: require("../../assets/images/products/cantabrico-generated-v1.webp") },
  "e15e4f9e-2c4c-dac7-cc60-4718af1d1c3b": { name: "Bologna", category: "Gourmet", recipe: "Stria, fuori cottura: mortadella, straciatella, crema di pistacchio", asset: require("../../assets/images/products/bologna-generated-v1.webp") },
  "5bba5ee7-2027-0ba7-63aa-e40836611a97": { name: "Nord e Sud", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, 'nduja e gorgonzola", asset: require("../../assets/images/products/nord-e-sud-generated-v1.webp") },
  "55d27bcb-fdb1-eceb-cac1-4c7875927e5e": { name: "Valtellina", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, bresaola, rucola, scaglie di grana", asset: require("../../assets/images/products/valtellina-generated-v2.webp") },
  "8a1fb53c-4a9f-8af3-8484-9ac1e1b71ba0": { name: "La fumè", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, speck, scamorza affumicata", asset: require("../../assets/images/products/la-fume-generated-v1.webp") },
  "48c851ca-a589-0737-4574-ad4e2cd5a2eb": { name: "Vegetariana", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, melanzane, peperoni, zucchine", asset: require("../../assets/images/products/vegetariana-generated-v1.webp") },
  "83c6feb1-5c4a-084f-56d9-33acb4bc31c5": { name: "Miami", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, gamberetti, zucchine", asset: require("../../assets/images/products/miami-generated-v1.webp") },
  "c54c0b8a-4ea7-0a43-9f1e-52eeaf685091": { name: "La Corte Vecia", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, rucola, scaglie di grana, glassa di aceto balsamico", asset: require("../../assets/images/products/la-corte-vecia-generated-v1.webp") },
  "50bc1973-f42f-d472-9003-58d321a67c91": { name: "Canossa", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, prosciutto crudo di parma, rucola, scaglie di grana, glassa di aceto balsamico", asset: require("../../assets/images/products/canossa-generated-v1.webp") },
  "60dc8568-fc82-4ea9-4b07-18f9275ac214": { name: "Frutti di Mare", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, seppie, calamari, vongole, cozze, polpi, surimi", asset: require("../../assets/images/products/frutti-di-mare-generated-v1.webp") },
  "6ed0c042-e272-74a2-1b9e-8e35b5ac40fe": { name: "Amalfi", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, scamorza affumicata, pomodorini", asset: require("../../assets/images/products/amalfi-generated-v1.webp") },
  "d91f0e5d-7a7e-dd4e-3dfe-f6467cab8c2f": { name: "Trentina", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, gorgonzola, speck", asset: require("../../assets/images/products/trentina-generated-v1.webp") },
  "ed918e23-e4db-f042-2f1d-0f3bbb86fd4e": { name: "Francescana", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, gorgonzola, porcini trifolati", asset: require("../../assets/images/products/francescana-generated-v1.webp") },
  "d8585032-7b09-e145-17d2-6fa01a49441b": { name: "Tirolese", category: "Gustose", recipe: "pomodoro, mozz.fior di latte e di bufala, porcini trifolati, speck", asset: require("../../assets/images/products/tirolese-generated-v1.webp") },
  "42f86782-d03a-633c-260d-0494e2e66c70": { name: "Matildica", category: "Gustose", recipe: "pomodoro, mozz.fior di latte, funghi porcini trifolati, pomodorini, parmigiano reggiano", asset: require("../../assets/images/products/matildica-generated-v1.webp") },
  "cb87873f-000c-2283-bab2-bf021f9b5eb7": { name: "Buna", category: "Bianche", recipe: "mozz.fior di latte, salsiccia, friarielli", asset: require("../../assets/images/products/buna-generated-v1.webp") },
  "638ef407-8372-1dde-1281-8f0c49e4bae7": { name: "Tartufata", category: "Bianche", recipe: "mozz.fior di latte, porcini, crema tartufata", asset: require("../../assets/images/products/tartufata-generated-v1.webp") },
  "4f5d8d14-972c-247e-180b-fbe667d11888": { name: "Messicana", category: "Bianche", recipe: "mozz.fior di latte e di bufala, pancetta, olio piccante", asset: require("../../assets/images/products/messicana-generated-v1.webp") },
  "d5cf8733-16e6-0f92-23f2-bc1ce260903a": { name: "Piccantina", category: "Bianche", recipe: "mozz.fior di latte, spianata calabra, acciughe, friarielli", asset: require("../../assets/images/products/piccantina-generated-v2.webp") },
  "6fe456ff-2489-0d9c-817e-796a07a06412": { name: "Beach", category: "Bianche", recipe: "mozz.fior di latte, rucola, pomodorini, gamberetti", asset: require("../../assets/images/products/beach-generated-v1.webp") },
  "80ab95e6-647b-d8c6-5906-b63096fa0fb5": { name: "Pizza del Centro", category: "Bianche", recipe: "mozz.fior di latte, melanzane, zucchine, peperoni, pomodorini, porcini", asset: require("../../assets/images/products/pizza-del-centro-generated-v2.webp") },
  "9f0d44a9-07b8-7371-1884-ffe12d66d699": { name: "Gorgonzola e Noci", category: "Bianche", recipe: "mozz.fior di latte, gorgonzola, noci", asset: require("../../assets/images/products/gorgonzola-e-noci-generated-v1.webp") },
  "05e8aca4-c6cb-31f4-dfdc-f786907c6989": { name: "Margherita", category: "Classiche", recipe: "pomodoro, mozz.fior di latte", asset: require("../../assets/images/products/margherita-generated-v1.webp") },
  "4b1a90b1-a400-9f0b-bdbf-3c98e4488fc4": { name: "Romana", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, acciughe, capperi, origano, olive", asset: require("../../assets/images/products/romana-generated-v1.webp") },
  "1061fbe6-509a-62e0-ae37-3f90cc918671": { name: "Marinara", category: "Classiche", recipe: "pomodoro, aglio, origano", asset: require("../../assets/images/products/marinara-generated-v1.webp") },
  "21e5edaf-f9f9-90f2-d4da-71b5ee01360d": { name: "Diavola", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, spianata calabra", asset: require("../../assets/images/products/diavola-generated-v1.webp") },
  "2f6ad905-62dc-47c9-2b68-8e9542812ee1": { name: "Stracchino e Rucola", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, stracchino, rucola", asset: require("../../assets/images/products/stracchino-e-rucola-generated-v1.webp") },
  "2d2e53df-ec08-225c-c4ba-7daf6f4af516": { name: "Napoli", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, acciughe, origano", asset: require("../../assets/images/products/napoli-generated-v1.webp") },
  "87f43a21-0340-b4c2-ea2c-fbdacfb41127": { name: "Calzone", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, prosciutto cotto", asset: require("../../assets/images/products/calzone-generated-v1.webp") },
  "8b850d81-139f-841c-d853-2706cefe3153": { name: "Calzone farcito", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, prosciutto cotto, funghi", asset: require("../../assets/images/products/calzone-farcito-generated-v1.webp") },
  "749f03a8-2b46-d080-faf2-d6b375e2228b": { name: "Quattro Stagioni", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, prosciutto cotto, funghi, carciofi, salsiccia", asset: require("../../assets/images/products/quattro-stagioni-generated-v1.webp") },
  "5576b740-1edb-5307-f2f6-4d7b8e2ff0aa": { name: "Crudo di Parma", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, prosciutto crudo di Parma", asset: require("../../assets/images/products/crudo-di-parma-generated-v1.webp") },
  "9b363f85-a930-d75f-3160-2a98996142b1": { name: "Pancetta", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, pancetta", asset: require("../../assets/images/products/pancetta-generated-v1.webp") },
  "8588a45b-f05b-da59-aeeb-e8aa336b06a6": { name: "Prosciutto", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, prosciutto cotto", asset: require("../../assets/images/products/prosciutto-generated-v1.webp") },
  "c275e551-dcf3-12f3-c9f4-9f8a55351ce1": { name: "Würstel", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, Würstel", asset: require("../../assets/images/products/wurstel-generated-v1.webp") },
  "d71787f2-8190-e631-51b3-5250e289efdf": { name: "Speck", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, speck", asset: require("../../assets/images/products/speck-generated-v1.webp") },
  "911dca27-294f-f4ac-1e63-d4923f96b154": { name: "Funghi", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, funghi", asset: require("../../assets/images/products/funghi-generated-v1.webp") },
  "17c5fe9c-fc81-90f8-5a03-c5b4a0b9e573": { name: "Tonno", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, tonno", asset: require("../../assets/images/products/tonno-generated-v1.webp") },
  "0348bd5e-ec70-3df8-3540-b81fcd9cff68": { name: "Salsiccia", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, salsiccia", asset: require("../../assets/images/products/salsiccia-generated-v1.webp") },
  "a85dece1-5bb3-b377-1719-7f9e936f9532": { name: "Quattro Formaggi", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, pecorino, emmental, gorgonzola", asset: require("../../assets/images/products/quattro-formaggi-generated-v2.webp") },
  "ded35530-96c1-52e7-421c-20876b27124b": { name: "Hanz", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, würstel, patatine fritte", asset: require("../../assets/images/products/hanz-generated-v1.webp") },
  "4acc4693-1c18-e39a-10bb-70f130b2e8e4": { name: "Capricciosa", category: "Classiche", recipe: "pomodoro, mozz.fior di latte, prosciutto cotto, funghi, carciofi, salsiccia, olive", asset: require("../../assets/images/products/capricciosa-generated-v1.webp") },
  "3f3c8d25-16be-242d-7fac-f7430168ee69": { name: "Speciale", category: "Classiche", recipe: "pomodoro, mozz.fior di latte di bufala, pomodorini, basilico", asset: require("../../assets/images/products/speciale-generated-v1.webp") },
};
const normalizeRecipe = (value: string) => value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
export function withPizzaPhoto<T extends Pick<Product, 'id' | 'description' | 'image_url'>>(product: T): T {
  const photo = PHOTOS[product.id];
  if (!photo || normalizeRecipe(product.description || '') !== normalizeRecipe(photo.recipe)) return product;
  return { ...product, image_url: Asset.fromModule(photo.asset).uri };
}

export function getPizzaPhotoCatalog() {
  return Object.entries(PHOTOS).map(([id, photo]) => ({ id, name: photo.name, category: photo.category, recipe: photo.recipe, imageUrl: Asset.fromModule(photo.asset).uri }));
}
