import { describe, expect, it } from 'vitest';
import type { TicketState } from '../../server/types';
import { isPreReady } from './ticketState';

describe('isPreReady', () => {
  it.each<[TicketState, boolean]>([
    ['NOT_READY', true],
    ['PLANNING', true],
    ['READY', false],
    ['IN_PROGRESS', false],
    ['IN_REVIEW', false],
    ['DONE', false],
    ['WONT_DO', false],
  ])('should return %s for state "%s"', (state, expected) => {
    expect(isPreReady(state)).toBe(expected);
  });
});
