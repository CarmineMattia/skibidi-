/**
 * cn utility function tests
 */

import { cn } from '@/lib/utils/cn';

describe('cn (className merge utility)', () => {
  it('merges two class strings', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    // twMerge merges conflicting classes - last one wins
    expect(cn('bg-gray-500', isActive && 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('handles falsey values', () => {
    const isActive = false;
    expect(cn('bg-gray-500', isActive && 'bg-blue-500')).toBe('bg-gray-500');
  });

  it('handles undefined and null', () => {
    expect(cn('bg-gray-500', undefined, null, 'text-white')).toBe('bg-gray-500 text-white');
  });

  it('handles empty strings', () => {
    expect(cn('', 'bg-blue-500', '')).toBe('bg-blue-500');
  });
});
