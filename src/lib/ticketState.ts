import type { TicketState } from '../../server/types';

export function stateLabel(state: TicketState): string {
  return state.replace('_', ' ');
}

export function stateColorClass(state: TicketState): string {
  switch (state) {
    case 'NOT_READY':
      return 'bg-nord-2 text-nord-4';
    case 'PLANNING':
      return 'bg-nord-7 text-nord-0';
    case 'READY':
      return 'bg-nord-9 text-nord-0';
    case 'IN_PROGRESS':
      return 'bg-nord-13 text-nord-0';
    case 'IN_REVIEW':
      return 'bg-nord-12 text-nord-0';
    case 'DONE':
      return 'bg-nord-14 text-nord-0';
  }
}
