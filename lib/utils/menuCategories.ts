/** Both the published Ambrosia names and older "Pizze ..." labels are supported. */
export function isPizzaCategoryName(categoryName?: string): boolean {
  const name = categoryName?.trim().toLowerCase() ?? '';
  return name.includes('pizz') || ['classiche', 'bianche', 'gustose', 'gourmet'].includes(name);
}

/** Categoria "Al metro" (pizze al metro). Stessa regola lato server (menu_category_kind). */
export function isMetroCategoryName(categoryName?: string): boolean {
  if (!categoryName) return false;
  return categoryName.toLowerCase().includes('metro');
}

/** Bevande: niente ingredienti aggiunti. Stessa regola lato server (menu_category_kind). */
export function isBeverageCategoryName(categoryName?: string): boolean {
  if (!categoryName) return false;
  return categoryName.toLowerCase().includes('bevand');
}

/**
 * Quanti gusti si possono scegliere per le pizze al metro,
 * dedotto dal nome del prodotto (Metà = 1, Due Terzi = 2, Farcita = 3).
 */
export function getMaxGustiForProduct(productName: string, categoryName?: string): number {
  if (!isMetroCategoryName(categoryName)) return 0;
  const normalized = productName.toLowerCase();
  if (normalized.includes('metà') || normalized.includes('meta ')) return 1;
  if (normalized.includes('due terzi')) return 2;
  if (normalized.includes('farcita')) return 3;
  return 0;
}
