/** Both the published Ambrosia names and older "Pizze ..." labels are supported. */
export function isPizzaCategoryName(categoryName?: string): boolean {
  const name = categoryName?.trim().toLowerCase() ?? '';
  return name.includes('pizz') || ['classiche', 'bianche', 'gustose', 'gourmet'].includes(name);
}
