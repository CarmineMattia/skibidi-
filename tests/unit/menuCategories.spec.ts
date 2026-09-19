import { describe, expect, it } from 'vitest';
import { isPizzaCategoryName } from '../../lib/utils/menuCategories';

describe('pizza categories from the Ambrosia menu seed', () => {
  it.each(['Classiche', 'Bianche', 'Gustose', 'Gourmet', 'Pizze Classiche', ' gourmet '])('enables pizza sizes for %s', (name) => {
    expect(isPizzaCategoryName(name)).toBe(true);
  });
  it.each(['Bevande', 'Dolci', 'Supplementi', 'Al metro', undefined])('does not treat %s as a standard pizza category', (name) => {
    expect(isPizzaCategoryName(name)).toBe(false);
  });
});
