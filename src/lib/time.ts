const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatTimestamp(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  const diffWeek = Math.floor(diffDay / 7);
  if (diffDay < 28) return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffDay < 365) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`;

  const d = new Date(iso);
  return `on ${MONTH_NAMES[d.getMonth()]}, ${d.getFullYear()}`;
}
