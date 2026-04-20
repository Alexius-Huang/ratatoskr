export function parseDisplayId(value: string, prefix: string): number | null {
  const pattern = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);
  const match = value.match(pattern);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractTicketNumber(displayId: string | null): number | null {
  if (!displayId) return null;
  const match = displayId.match(/(?:^|-)(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
