import { describe, it, expect } from 'vitest';
import { avatarColor } from './avatarColor';

describe('avatarColor', () => {
  it('should return the same bg/fg for the same name on repeated calls', () => {
    expect(avatarColor('Alice')).toEqual(avatarColor('Alice'));
  });

  it('should return different colors for clearly different names', () => {
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank'];
    const bgs = new Set(names.map((n) => avatarColor(n).bg));
    expect(bgs.size).toBeGreaterThan(1);
  });

  it('should never return undefined or empty strings', () => {
    const names = ['Alice', 'Bob', 'x', '123', 'Test User'];
    for (const name of names) {
      const { bg, fg } = avatarColor(name);
      expect(bg).toBeTruthy();
      expect(fg).toBeTruthy();
    }
  });
});
