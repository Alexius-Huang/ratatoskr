import type { TicketSummary } from '../types';

let _n = 0;
function nextN() { return ++_n; }

export function makeTicketSummary(overrides: Partial<TicketSummary> = {}): TicketSummary {
  const n = overrides.number ?? nextN();
  return {
    number: n,
    displayId: `RAT-${n}`,
    type: 'Task',
    title: `Ticket ${n}`,
    state: 'NOT_READY',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    blocks: [],
    blockedBy: [],
    ...overrides,
  };
}
