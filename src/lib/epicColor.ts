export const EPIC_PALETTE = [
  '#BF616A', // red
  '#D08770', // orange
  '#EBCB8B', // yellow
  '#A3BE8C', // green
  '#8FBCBB', // teal
  '#88C0D0', // cyan
  '#81A1C1', // light blue
  '#5E81AC', // blue
  '#B48EAD', // purple
  '#C678DD', // violet
  '#D19A66', // amber
  '#56B6C2', // deep teal
] as const;

/** Deterministic fallback: same epic number always maps to the same palette entry. */
export function defaultEpicColor(epicNumber: number): string {
  return EPIC_PALETTE[epicNumber % EPIC_PALETTE.length];
}

export type EpicTagStyle = {
  className: string;
  style: { backgroundColor: string; color: string };
};

export function tagStyle(hex: string): EpicTagStyle {
  return {
    className:
      'inline-block max-w-full truncate px-2 py-0.5 rounded text-xs font-medium',
    style: { backgroundColor: `${hex}33`, color: hex },
  };
}
