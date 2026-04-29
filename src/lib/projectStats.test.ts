// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeProjectStats } from './projectStats';
import { makeTicketSummary } from '../test/factories';
import type { TicketState } from '../../server/types';

describe('computeProjectStats', () => {
  it('should return all-zero stats for an empty array', () => {
    const result = computeProjectStats([]);
    expect(result).toEqual({ done: 0, inProgress: 0, todo: 0, total: 0, openBugs: 0 });
  });

  it('should bucket DONE tickets into done', () => {
    const tickets = [makeTicketSummary({ state: 'DONE' })];
    const result = computeProjectStats(tickets);
    expect(result.done).toBe(1);
    expect(result.inProgress).toBe(0);
    expect(result.todo).toBe(0);
    expect(result.total).toBe(1);
  });

  it.each<TicketState>(['PLANNING', 'READY', 'IN_PROGRESS', 'IN_REVIEW'])(
    'should bucket %s into inProgress',
    (state) => {
      const tickets = [makeTicketSummary({ state })];
      const result = computeProjectStats(tickets);
      expect(result.inProgress).toBe(1);
      expect(result.done).toBe(0);
      expect(result.todo).toBe(0);
      expect(result.total).toBe(1);
    },
  );

  it('should bucket NOT_READY into todo', () => {
    const tickets = [makeTicketSummary({ state: 'NOT_READY' })];
    const result = computeProjectStats(tickets);
    expect(result.todo).toBe(1);
    expect(result.done).toBe(0);
    expect(result.inProgress).toBe(0);
    expect(result.total).toBe(1);
  });

  it('should exclude WONT_DO from total and from every bucket', () => {
    const tickets = [makeTicketSummary({ state: 'WONT_DO' })];
    const result = computeProjectStats(tickets);
    expect(result.done).toBe(0);
    expect(result.inProgress).toBe(0);
    expect(result.todo).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should count open bugs (type=Bug, state not DONE or WONT_DO)', () => {
    const tickets = [
      makeTicketSummary({ type: 'Bug', state: 'IN_PROGRESS' }),
      makeTicketSummary({ type: 'Bug', state: 'NOT_READY' }),
      makeTicketSummary({ type: 'Bug', state: 'PLANNING' }),
    ];
    const result = computeProjectStats(tickets);
    expect(result.openBugs).toBe(3);
  });

  it.each<TicketState>(['DONE', 'WONT_DO'])(
    'should not count Bug %s as open bugs',
    (state) => {
      const tickets = [makeTicketSummary({ type: 'Bug', state })];
      const result = computeProjectStats(tickets);
      expect(result.openBugs).toBe(0);
    },
  );

  it('should compute correct totals for a mixed set of tickets', () => {
    const tickets = [
      makeTicketSummary({ state: 'DONE' }),
      makeTicketSummary({ state: 'DONE' }),
      makeTicketSummary({ state: 'IN_PROGRESS' }),
      makeTicketSummary({ state: 'NOT_READY' }),
      makeTicketSummary({ state: 'WONT_DO' }),
      makeTicketSummary({ type: 'Bug', state: 'IN_REVIEW' }),
    ];
    const result = computeProjectStats(tickets);
    expect(result.done).toBe(2);
    expect(result.inProgress).toBe(2);
    expect(result.todo).toBe(1);
    expect(result.total).toBe(5);
    expect(result.openBugs).toBe(1);
  });
});
