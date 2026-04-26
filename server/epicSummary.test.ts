import { describe, expect, it } from 'vitest';
import { makeTicketSummary } from './test/factories';
import { buildEpicSummaryBlock } from './epicSummary';

function makeChild(overrides: Parameters<typeof makeTicketSummary>[0] = {}) {
  return makeTicketSummary({ state: 'DONE', updated: '2026-01-15T10:30:00.000Z', ...overrides });
}

describe('buildEpicSummaryBlock', () => {
  it('should render "1 child ticket" for a single child', () => {
    const block = buildEpicSummaryBlock([makeChild()], '2026-01-20T00:00:00.000Z');
    expect(block).toContain('with 1 child ticket:');
  });

  it('should render "N child tickets" for multiple children', () => {
    const children = [makeChild({ number: 1 }), makeChild({ number: 2, displayId: 'RAT-2' })];
    const block = buildEpicSummaryBlock(children, '2026-01-20T00:00:00.000Z');
    expect(block).toContain('with 2 child tickets:');
  });

  it('should sort children by number ascending', () => {
    const children = [
      makeChild({ number: 3, displayId: 'RAT-3', title: 'Third' }),
      makeChild({ number: 1, displayId: 'RAT-1', title: 'First' }),
      makeChild({ number: 2, displayId: 'RAT-2', title: 'Second' }),
    ];
    const block = buildEpicSummaryBlock(children, '2026-01-20T00:00:00.000Z');
    const firstIdx = block.indexOf('RAT-1');
    const secondIdx = block.indexOf('RAT-2');
    const thirdIdx = block.indexOf('RAT-3');
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it('should format the completion date as YYYY-MM-DD', () => {
    const block = buildEpicSummaryBlock([makeChild()], '2026-03-15T12:00:00.000Z');
    expect(block).toContain('Completed on 2026-03-15');
  });

  it('should format each child DONE date from its updated timestamp', () => {
    const child = makeChild({ updated: '2026-02-28T23:59:59.000Z' });
    const block = buildEpicSummaryBlock([child], '2026-03-01T00:00:00.000Z');
    expect(block).toContain('DONE 2026-02-28');
  });
});
