import { faker } from '@faker-js/faker';
import type { ArchivedTicketRecord, Comment, TicketDetail, TicketSummary } from '../../server/types';

const nextN = (() => {
  let n = 0;
  return () => ++n;
})();

export function makeTicketSummary(overrides: Partial<TicketSummary> = {}): TicketSummary {
  const n = overrides.number ?? nextN();
  return {
    number: n,
    displayId: `RAT-${n}`,
    type: 'Task',
    title: faker.lorem.words(3),
    state: 'IN_PROGRESS',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    blocks: [],
    blockedBy: [],
    ...overrides,
  };
}

export function makeEpicSummary(overrides: Partial<TicketSummary> = {}): TicketSummary {
  return makeTicketSummary({ type: 'Epic', ...overrides });
}

export function makeTicketDetail(overrides: Partial<TicketDetail> = {}): TicketDetail {
  const base = makeTicketSummary(overrides);
  return {
    ...base,
    body: '',
    comments: [],
    ...overrides,
  };
}

export function makeArchivedRecord(overrides: Partial<ArchivedTicketRecord> = {}): ArchivedTicketRecord {
  const base = makeTicketDetail(overrides);
  return {
    ...base,
    archived: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  const n = overrides.n ?? nextN();
  return {
    n,
    author: 'testuser',
    displayName: 'Test User',
    timestamp: '2026-01-01T00:00:00.000Z',
    body: faker.lorem.sentence(),
    ...overrides,
  };
}
