import type { TicketSummary } from './types';

function ymd(iso: string): string {
  return iso.slice(0, 10);
}

export function buildEpicSummaryBlock(
  children: TicketSummary[],
  completedAtIso: string,
): string {
  const sorted = [...children].sort((a, b) => a.number - b.number);
  const lines = sorted.map(
    (c) => `- ${c.displayId} — ${c.title} (DONE ${ymd(c.updated)})`,
  );
  const n = sorted.length;
  const noun = n === 1 ? 'child ticket' : 'child tickets';
  return [
    '',
    '',
    '## Summary',
    '',
    `Completed on ${ymd(completedAtIso)} with ${n} ${noun}:`,
    '',
    ...lines,
    '',
  ].join('\n');
}
