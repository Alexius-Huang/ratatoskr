import type { TicketResolution } from '../../server/types';

export function resolutionLabel(r: TicketResolution): string {
  switch (r) {
    case 'VIBED': return 'VIBED';
    case 'PLANNED': return 'PLANNED';
    case 'MANUAL': return 'MANUAL';
  }
}
