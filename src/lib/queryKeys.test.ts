import { describe, expect, it } from 'vitest';
import { ticketsInvalidationPredicate, ticketsKey } from './queryKeys';

describe('ticketsKey', () => {
  it('should return [\'tickets\', projectName, "all"] when no typesCsv is given', () => {
    expect(ticketsKey('ratatoskr')).toEqual(['tickets', 'ratatoskr', 'all']);
  });

  it('should return [\'tickets\', projectName, "all"] when typesCsv is null', () => {
    expect(ticketsKey('ratatoskr', null)).toEqual(['tickets', 'ratatoskr', 'all']);
  });

  it('should return [\'tickets\', projectName, csv] when typesCsv is a non-empty string', () => {
    expect(ticketsKey('ratatoskr', 'Task,Bug')).toEqual(['tickets', 'ratatoskr', 'Task,Bug']);
  });
});

describe('ticketsInvalidationPredicate', () => {
  it('should match a query key with the same projectName regardless of the third slot', () => {
    const predicate = ticketsInvalidationPredicate('ratatoskr');
    expect(predicate({ queryKey: ['tickets', 'ratatoskr', 'all'] })).toBe(true);
    expect(predicate({ queryKey: ['tickets', 'ratatoskr', 'Task,Bug'] })).toBe(true);
    expect(predicate({ queryKey: ['tickets', 'ratatoskr', 'Epic'] })).toBe(true);
  });

  it('should not match a query key for a different projectName', () => {
    const predicate = ticketsInvalidationPredicate('ratatoskr');
    expect(predicate({ queryKey: ['tickets', 'muninn', 'all'] })).toBe(false);
  });

  it('should not match a query key whose first slot is not "tickets"', () => {
    const predicate = ticketsInvalidationPredicate('ratatoskr');
    expect(predicate({ queryKey: ['ticket', 'ratatoskr', 1] })).toBe(false);
    expect(predicate({ queryKey: ['archive', 'ratatoskr'] })).toBe(false);
  });

  it('should not match when queryKey is not an array', () => {
    const predicate = ticketsInvalidationPredicate('ratatoskr');
    expect(predicate({ queryKey: 'tickets' as unknown as readonly unknown[] })).toBe(false);
  });
});
