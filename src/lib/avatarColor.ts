const PALETTE = [
  'bg-nord-7',
  'bg-nord-8',
  'bg-nord-9',
  'bg-nord-10',
  'bg-nord-12',
  'bg-nord-13',
  'bg-nord-14',
  'bg-nord-15',
];

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

export function avatarColor(name: string): { bg: string; fg: string } {
  const hash = fnv1a(name.toLowerCase());
  return {
    bg: PALETTE[hash % PALETTE.length],
    fg: 'text-nord-0',
  };
}
