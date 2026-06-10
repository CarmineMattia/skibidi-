/**
 * Catalogo ingredienti Pizzeria Ambrosia
 *
 * Fonte: menu reale (supabase/seed-ambrosia-menu.sql) + aggiunte classiche da pizzeria.
 * Usato per: search bar ingredienti nella scheda prodotto, suggerimenti
 * "il pizzaiolo consiglia", composizione mezzi metri e "componi la tua pizza".
 */

export type IngredientCategoryId =
  | 'salse'
  | 'formaggi'
  | 'salumi'
  | 'verdure'
  | 'pesce'
  | 'extra';

export type PizzaBase = 'rossa' | 'bianca';

export interface IngredientCategoryInfo {
  id: IngredientCategoryId;
  label: string;
  emoji: string;
  /** Pallino colorato nelle chip ingrediente */
  dotClass: string;
  /** Sfondo/bordo delle chip della categoria */
  chipClass: string;
  /** Colore testo delle chip della categoria */
  textClass: string;
}

export const INGREDIENT_CATEGORIES: IngredientCategoryInfo[] = [
  { id: 'salse', label: 'Salse e creme', emoji: '🍅', dotClass: 'bg-rose-500', chipClass: 'bg-rose-50 border-rose-200', textClass: 'text-rose-900' },
  { id: 'formaggi', label: 'Formaggi', emoji: '🧀', dotClass: 'bg-amber-400', chipClass: 'bg-amber-50 border-amber-200', textClass: 'text-amber-900' },
  { id: 'salumi', label: 'Salumi e carne', emoji: '🥓', dotClass: 'bg-red-600', chipClass: 'bg-red-50 border-red-200', textClass: 'text-red-900' },
  { id: 'verdure', label: 'Verdure', emoji: '🥬', dotClass: 'bg-emerald-500', chipClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-900' },
  { id: 'pesce', label: 'Pesce', emoji: '🐟', dotClass: 'bg-sky-500', chipClass: 'bg-sky-50 border-sky-200', textClass: 'text-sky-900' },
  { id: 'extra', label: 'Extra', emoji: '✨', dotClass: 'bg-zinc-400', chipClass: 'bg-zinc-50 border-zinc-200', textClass: 'text-zinc-800' },
];

export interface CatalogIngredient {
  name: string;
  category: IngredientCategoryId;
  /** Base su cui l'ingrediente rende meglio; assente = va bene su entrambe */
  base?: PizzaBase;
  /** Ingredienti già sulla pizza con cui l'abbinamento è da pizzaiolo */
  pairsWith?: string[];
  /** Ingredienti con cui l'abbinamento è sconsigliato */
  clashesWith?: string[];
}

export const INGREDIENT_CATALOG: CatalogIngredient[] = [
  // Salse e creme
  { name: 'Pomodoro', category: 'salse', base: 'rossa' },
  { name: 'Crema di radicchio', category: 'salse', pairsWith: ['salsiccia', 'scamorza', 'speck'] },
  { name: 'Crema tartufata', category: 'salse', pairsWith: ['porcini', 'funghi', 'grana'] },
  { name: 'Crema di pistacchio', category: 'salse', base: 'bianca', pairsWith: ['mortadella', 'stracciatella', 'burrata'] },
  { name: 'Pesto genovese', category: 'salse', pairsWith: ['pomodorini', 'bufala', 'stracciatella'] },
  { name: 'Glassa di aceto balsamico', category: 'salse', pairsWith: ['rucola', 'grana', 'crudo', 'bresaola'] },
  { name: 'Olio piccante', category: 'salse', pairsWith: ['salame piccante', "'nduja", 'friarielli', 'acciughe', 'seppie', 'calamari'] },

  // Formaggi
  { name: 'Mozzarella', category: 'formaggi', pairsWith: ['pomodoro'] },
  { name: 'Mozzarella di bufala', category: 'formaggi', pairsWith: ['pomodorini', 'basilico', 'crudo'] },
  { name: 'Burrata', category: 'formaggi', pairsWith: ['pomodorini', "'nduja", 'salame piccante', 'crudo', 'mortadella'] },
  { name: 'Stracciatella', category: 'formaggi', base: 'bianca', pairsWith: ['mortadella', 'crema di pistacchio', "'nduja", 'speck'] },
  { name: 'Gorgonzola', category: 'formaggi', pairsWith: ['speck', 'salsiccia', 'radicchio', 'noci', 'porcini', 'pancetta'] },
  { name: 'Scamorza affumicata', category: 'formaggi', pairsWith: ['speck', 'pancetta', 'patate', 'salsiccia', 'porcini'] },
  { name: 'Parmigiano Reggiano', category: 'formaggi', pairsWith: ['rucola', 'crudo', 'bresaola', 'pomodorini'] },
  { name: 'Scaglie di grana', category: 'formaggi', pairsWith: ['rucola', 'crudo', 'bresaola', 'glassa'] },
  { name: 'Stracchino', category: 'formaggi', base: 'bianca', pairsWith: ['patate', 'pancetta', 'salsiccia', 'rucola'] },

  // Salumi e carne
  { name: 'Prosciutto cotto', category: 'salumi', pairsWith: ['funghi', 'champignon', 'mozzarella'] },
  { name: 'Prosciutto crudo', category: 'salumi', pairsWith: ['rucola', 'grana', 'bufala', 'pomodorini', 'burrata'] },
  { name: 'Salame piccante', category: 'salumi', pairsWith: ['friarielli', 'olio piccante', 'burrata', 'cipolla'] },
  { name: 'Salsiccia', category: 'salumi', pairsWith: ['friarielli', 'porcini', 'gorgonzola', 'patate', 'crema di radicchio'] },
  { name: "'Nduja", category: 'salumi', base: 'rossa', pairsWith: ['burrata', 'stracciatella', 'cipolla', 'gorgonzola'] },
  { name: 'Speck', category: 'salumi', pairsWith: ['gorgonzola', 'scamorza', 'porcini', 'noci', 'crema di radicchio'] },
  { name: 'Pancetta', category: 'salumi', pairsWith: ['gorgonzola', 'uova', 'patate', 'stracchino', 'radicchio'] },
  { name: 'Bresaola', category: 'salumi', pairsWith: ['rucola', 'grana', 'glassa', 'pomodorini'] },
  { name: 'Mortadella', category: 'salumi', base: 'bianca', pairsWith: ['stracciatella', 'crema di pistacchio', 'burrata'] },
  { name: 'Wurstel', category: 'salumi', pairsWith: ['patate'] },

  // Verdure
  { name: 'Basilico', category: 'verdure', pairsWith: ['pomodoro', 'pomodorini', 'bufala'] },
  { name: 'Pomodorini', category: 'verdure', pairsWith: ['bufala', 'basilico', 'rucola', 'burrata', 'pesto'] },
  { name: 'Rucola', category: 'verdure', pairsWith: ['crudo', 'bresaola', 'grana', 'pomodorini', 'glassa'] },
  { name: 'Friarielli', category: 'verdure', base: 'bianca', pairsWith: ['salsiccia', 'salame piccante', 'olio piccante'] },
  { name: 'Melanzane', category: 'verdure', base: 'rossa', pairsWith: ['zucchine', 'peperoni', 'pomodorini', 'grana'] },
  { name: 'Zucchine', category: 'verdure', pairsWith: ['melanzane', 'peperoni', 'gamberetti', 'speck'] },
  { name: 'Peperoni', category: 'verdure', base: 'rossa', pairsWith: ['melanzane', 'zucchine', 'salsiccia', 'cipolla'] },
  { name: 'Radicchio', category: 'verdure', pairsWith: ['gorgonzola', 'pancetta', 'speck', 'salsiccia'] },
  { name: 'Porcini trifolati', category: 'verdure', pairsWith: ['speck', 'salsiccia', 'crema tartufata', 'gorgonzola', 'grana'] },
  { name: 'Funghi champignon', category: 'verdure', pairsWith: ['prosciutto cotto', 'salsiccia'] },
  { name: 'Cipolla', category: 'verdure', base: 'rossa', pairsWith: ['tonno', "'nduja", 'salsiccia', 'peperoni'] },
  { name: 'Olive nere', category: 'verdure', base: 'rossa', pairsWith: ['acciughe', 'capperi', 'tonno', 'cipolla'] },
  { name: 'Capperi', category: 'verdure', base: 'rossa', pairsWith: ['acciughe', 'olive', 'origano', 'tonno'] },
  { name: 'Mais', category: 'verdure', pairsWith: ['wurstel', 'prosciutto cotto'] },
  { name: 'Patate al forno', category: 'verdure', base: 'bianca', pairsWith: ['salsiccia', 'pancetta', 'stracchino', 'wurstel', 'scamorza'] },

  // Pesce
  { name: 'Tonno', category: 'pesce', base: 'rossa', pairsWith: ['cipolla', 'olive'] },
  { name: 'Acciughe', category: 'pesce', base: 'rossa', pairsWith: ['capperi', 'olive', 'origano', 'olio piccante'] },
  { name: 'Gamberetti', category: 'pesce', pairsWith: ['zucchine'] },
  { name: 'Frutti di mare', category: 'pesce', base: 'rossa', pairsWith: ['aglio', 'olio piccante', 'prezzemolo'] },

  // Extra
  { name: 'Origano', category: 'extra', base: 'rossa', pairsWith: ['pomodoro', 'acciughe', 'capperi'] },
  { name: 'Aglio', category: 'extra', pairsWith: ['pomodoro', 'origano', 'frutti di mare', 'seppie', 'vongole'] },
  { name: 'Uova', category: 'extra', pairsWith: ['pancetta', 'pepe nero'] },
  { name: 'Noci', category: 'extra', base: 'bianca', pairsWith: ['gorgonzola', 'radicchio'] },
  { name: 'Pepe nero', category: 'extra', pairsWith: ['uova', 'pancetta', 'bufala'] },
  { name: 'Prezzemolo', category: 'extra', pairsWith: ['frutti di mare', 'aglio', 'gamberetti', 'seppie', 'calamari'] },
];

const SEAFOOD_PATTERN = /(seppie|calamari|vongole|cozze|polpi|surimi|gamberett|tonno|acciugh|frutti di mare)/;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesIngredient(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  return left === right || left.includes(right) || right.includes(left);
}

/** Trova la voce di catalogo corrispondente a un ingrediente di un prodotto. */
export function findCatalogIngredient(name: string): CatalogIngredient | undefined {
  const target = normalize(name);
  return (
    INGREDIENT_CATALOG.find((entry) => normalize(entry.name) === target) ??
    INGREDIENT_CATALOG.find((entry) => matchesIngredient(entry.name, target))
  );
}

/** Classifica un ingrediente (anche fuori catalogo) in una categoria. */
export function categorizeIngredient(name: string): IngredientCategoryId {
  const found = findCatalogIngredient(name);
  if (found) return found.category;

  const target = normalize(name);
  if (/(crema|salsa|pesto|glassa|olio)/.test(target)) return 'salse';
  if (/(mozzarella|formagg|bufala|grana|parmigiano|pecorino|provola|fontina|brie|ricotta)/.test(target)) return 'formaggi';
  if (/(prosciutto|salame|salamino|speck|pancetta|bresaola|mortadella|salsiccia|wurstel|nduja|carne|pollo)/.test(target)) return 'salumi';
  if (SEAFOOD_PATTERN.test(target)) return 'pesce';
  if (/(pomodorin|verdur|fungh|porcini|melanzan|zucchin|peperon|rucola|radicchio|friarielli|cipolla|oliv|capperi|patat|basilico|spinaci|carciof)/.test(target)) return 'verdure';
  return 'extra';
}

export function getCategoryInfo(id: IngredientCategoryId): IngredientCategoryInfo {
  return INGREDIENT_CATEGORIES.find((category) => category.id === id) ?? INGREDIENT_CATEGORIES[INGREDIENT_CATEGORIES.length - 1];
}

/**
 * Rileva la base della pizza: rossa se tra ingredienti/descrizione compare il
 * pomodoro (base), bianca altrimenti. I pomodorini non contano come base.
 */
export function detectPizzaBase(ingredients: string[] | null | undefined, description?: string | null): PizzaBase {
  const haystack = [...(ingredients ?? []), description ?? ''];
  const hasTomatoBase = haystack.some((value) => {
    const normalized = normalize(value);
    return normalized.includes('pomodoro') && !normalized.includes('pomodorino');
  });
  return hasTomatoBase ? 'rossa' : 'bianca';
}

/**
 * Suggerimenti "da pizzaiolo": ingredienti del catalogo che si sposano con la
 * base e con gli ingredienti già presenti. Deterministico: stessa pizza,
 * stessi consigli.
 */
export function getIngredientSuggestions(
  existingIngredients: string[],
  base: PizzaBase,
  max: number = 6
): CatalogIngredient[] {
  const existing = existingIngredients.map(normalize).filter((value) => value.length > 0);
  const hasSeafood = existing.some((value) => SEAFOOD_PATTERN.test(value));

  const isAlreadyOnPizza = (entry: CatalogIngredient): boolean =>
    existing.some((value) => matchesIngredient(value, entry.name));

  const scored = INGREDIENT_CATALOG
    .filter((entry) => !isAlreadyOnPizza(entry))
    .map((entry) => {
      let score = 0;

      if (!entry.base || entry.base === base) score += 2;
      else score -= 2;

      for (const pair of entry.pairsWith ?? []) {
        if (existing.some((value) => matchesIngredient(value, pair))) score += 3;
      }
      for (const clash of entry.clashesWith ?? []) {
        if (existing.some((value) => matchesIngredient(value, clash))) score -= 10;
      }

      // Regola del pizzaiolo: niente formaggi/salumi sul pesce e niente pesce
      // dove non c'entra.
      if (hasSeafood && (entry.category === 'formaggi' || entry.category === 'salumi')) score -= 8;
      if (hasSeafood && entry.category === 'pesce') score += 2;
      if (!hasSeafood && entry.category === 'pesce') score -= 3;

      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));

  return scored.slice(0, max).map(({ entry }) => entry);
}
