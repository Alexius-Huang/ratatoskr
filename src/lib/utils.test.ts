import { cn } from './utils';

describe('cn', () => {
  it('combines class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values', () => {
    const falsy = false as const;
    expect(cn('a', falsy && 'b', 'c')).toBe('a c');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});
