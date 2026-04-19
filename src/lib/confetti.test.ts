import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import confetti from 'canvas-confetti';
import { fireEpicDoneConfetti } from './confetti';

const mockConfetti = vi.mocked(confetti);

describe('fireEpicDoneConfetti', () => {
  beforeEach(() => {
    mockConfetti.mockReset();
  });

  it('should fire a burst with origin.y > 1 (bottom of viewport) and angle 90 (straight up)', () => {
    fireEpicDoneConfetti();
    expect(mockConfetti).toHaveBeenCalledOnce();
    const opts = mockConfetti.mock.calls[0][0] as Record<string, unknown>;
    expect((opts.origin as { y: number }).y).toBeGreaterThan(1);
    expect(opts.angle).toBe(90);
  });

  it('should pass disableForReducedMotion: true', () => {
    fireEpicDoneConfetti();
    const opts = mockConfetti.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.disableForReducedMotion).toBe(true);
  });
});
