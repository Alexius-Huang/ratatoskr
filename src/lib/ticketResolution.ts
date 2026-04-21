import type { TicketResolution } from '../../server/types';

export function resolutionLabel(r: TicketResolution): string {
  switch (r) {
    case 'VIBED': return 'Vibed';
    case 'PLANNED': return 'Planned';
    case 'MANUAL': return 'Manual';
  }
}
