import { describe, expect, it } from 'vitest';
import { EPIC_PALETTE, defaultEpicColor, tagStyle } from './epicColor';

describe('defaultEpicColor', () => {
  it('should return a color from EPIC_PALETTE', () => {
    const color = defaultEpicColor(1);
    expect(EPIC_PALETTE).toContain(color);
  });

  it('should be deterministic — same number always returns the same color', () => {
    expect(defaultEpicColor(5)).toBe(defaultEpicColor(5));
  });

  it('should wrap around — epic 0 and epic 12 get the same color', () => {
    expect(defaultEpicColor(0)).toBe(defaultEpicColor(EPIC_PALETTE.length));
  });
});

describe('tagStyle', () => {
  it('should return inline style with 20%-alpha background and full-alpha text', () => {
    const s = tagStyle('#BF616A');
    expect(s.style.backgroundColor).toBe('#BF616A33');
    expect(s.style.color).toBe('#BF616A');
  });

  it('should always include the base pill className', () => {
    const s = tagStyle('#A3BE8C');
    expect(s.className).toContain('px-2');
    expect(s.className).toContain('rounded');
    expect(s.className).toContain('text-xs');
  });
});
