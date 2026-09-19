/**
 * Miniature ingredienti (TheMealDB) mappate dai nomi italiani del listino Ambrosia.
 * Usare getIngredientImageUrl() + <IngredientThumb />.
 */

const MEALDB = 'https://www.themealdb.com/images/ingredients';

/** Chiave = nome normalizzato (lower, senza accenti estremi) → file MealDB (EN) */
const INGREDIENT_IMAGE_KEYS: Record<string, string> = {
  // salse / creme
  pomodoro: 'Tomato',
  'crema di radicchio': 'Beetroot',
  'crema tartufata': 'Mushrooms',
  'crema di pistacchio': 'Pistachio',
  'pesto genovese': 'Basil',
  'glassa di aceto balsamico': 'Balsamic Vinegar',
  'glassa balsamica': 'Balsamic Vinegar',
  'olio piccante': 'Olive Oil',

  // formaggi
  mozzarella: 'Mozzarella',
  'mozzarella di bufala': 'Mozzarella',
  bufala: 'Mozzarella',
  burrata: 'Mozzarella',
  stracciatella: 'Mozzarella',
  gorgonzola: 'Cheese',
  'scamorza affumicata': 'Cheddar Cheese',
  scamorza: 'Cheddar Cheese',
  'parmigiano reggiano': 'Parmesan',
  'scaglie di grana': 'Parmesan',
  grana: 'Parmesan',
  stracchino: 'Cream Cheese',

  // salumi
  'prosciutto cotto': 'Ham',
  'prosciutto crudo': 'Ham',
  crudo: 'Ham',
  'salame piccante': 'Chorizo',
  salsiccia: 'Sausages',
  "'nduja": 'Chilli',
  nduja: 'Chilli',
  speck: 'Bacon',
  pancetta: 'Bacon',
  bresaola: 'Beef',
  mortadella: 'Ham',
  wurstel: 'Sausages',

  // verdure
  basilico: 'Basil',
  pomodorini: 'Cherry Tomatoes',
  rucola: 'Rocket',
  friarielli: 'Spinach',
  melanzane: 'Aubergine',
  zucchine: 'Courgettes',
  peperoni: 'Pepper',
  radicchio: 'Lettuce',
  'porcini trifolati': 'Mushrooms',
  'funghi porcini trifolati': 'Mushrooms',
  porcini: 'Mushrooms',
  'funghi champignon': 'Mushrooms',
  funghi: 'Mushrooms',
  cipolla: 'Onion',
  'olive nere': 'Black Olives',
  olive: 'Black Olives',
  capperi: 'Capers',
  mais: 'Sweetcorn',
  'patate al forno': 'Potatoes',
  patate: 'Potatoes',

  // pesce
  tonno: 'Tuna',
  acciughe: 'Anchovies',
  gamberetti: 'Prawns',
  'frutti di mare': 'Prawns',
  seppie: 'Squid',
  calamari: 'Squid',
  vongole: 'Clams',
  cozze: 'Mussels',
  polpi: 'Squid',
  surimi: 'Prawns',

  // extra
  origano: 'Oregano',
  aglio: 'Garlic',
  uova: 'Egg',
  noci: 'Walnuts',
  'pepe nero': 'Black Pepper',
  prezzemolo: 'Parsley',
};

function normalizeIngredientName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Alias / varianti tipiche del listino → chiave canonica */
const ALIASES: Record<string, string> = {
  'mozzarella (1 metro)': 'mozzarella',
  'funghi porcini': 'porcini',
};

export function getIngredientImageUrl(ingredientName: string): string | null {
  const raw = normalizeIngredientName(ingredientName);
  if (!raw) return null;

  const aliased = ALIASES[raw] ?? raw;
  const key = INGREDIENT_IMAGE_KEYS[aliased];
  if (key) {
    return `${MEALDB}/${encodeURIComponent(key)}.png`;
  }

  // match soft: chiave contenuta nel nome o viceversa
  for (const [name, file] of Object.entries(INGREDIENT_IMAGE_KEYS)) {
    if (aliased.includes(name) || name.includes(aliased)) {
      return `${MEALDB}/${encodeURIComponent(file)}.png`;
    }
  }

  return null;
}
