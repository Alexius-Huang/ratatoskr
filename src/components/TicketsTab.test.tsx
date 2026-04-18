// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TicketSummary } from '../../server/types';
import { renderWithProviders } from '../test/renderWithProviders';
import { TicketsTab } from './TicketsTab';

vi.mock('../lib/api', () => ({
  useTickets: vi.fn(),
}));

vi.mock('../lib/ticketMutations', () => ({
  useArchiveDoneTickets: vi.fn(),
}));

vi.mock('./CreateTicketModal', () => ({
  CreateTicketModal: () => null,
}));

vi.mock('./TicketDetailPanel', () => ({
  TicketDetailPanel: ({ displayId }: { displayId: string }) => (
    <div data-testid="detail-panel">{displayId}</div>
  ),
}));

vi.mock('./SplitPane', () => ({
  SplitPane: ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => (
    <>
      <div>{left}</div>
      <div>{right}</div>
    </>
  ),
}));

import { useTickets } from '../lib/api';
import { useArchiveDoneTickets } from '../lib/ticketMutations';

const mockUseTickets = vi.mocked(useTickets);
const mockUseArchiveDoneTickets = vi.mocked(useArchiveDoneTickets);

const fixtures: TicketSummary[] = [
  { number: 1, displayId: 'RAT-1', type: 'Task', title: 'Task one', state: 'READY', created: '', updated: '' },
  { number: 2, displayId: 'RAT-2', type: 'Task', title: 'Task two', state: 'IN_PROGRESS', created: '', updated: '' },
  { number: 3, displayId: 'RAT-3', type: 'Task', title: 'Task three', state: 'DONE', created: '', updated: '' },
];

const fixturesNoDone: TicketSummary[] = [
  { number: 1, displayId: 'RAT-1', type: 'Task', title: 'Task one', state: 'READY', created: '', updated: '' },
  { number: 2, displayId: 'RAT-2', type: 'Task', title: 'Task two', state: 'IN_PROGRESS', created: '', updated: '' },
];

function setupMocks(tickets = fixtures) {
  mockUseTickets.mockReturnValue({ data: tickets, isLoading: false, error: null } as ReturnType<typeof useTickets>);
  mockUseArchiveDoneTickets.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null } as unknown as ReturnType<typeof useArchiveDoneTickets>);
}

function render() {
  return renderWithProviders(<TicketsTab />);
}

describe('TicketsTab', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('should render a row for each ticket', () => {
    render();
    const tbody = document.querySelector('tbody') as HTMLElement;
    const rows = within(tbody).getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('should open the detail panel when a ticket row is clicked', async () => {
    const user = userEvent.setup();
    render();
    const tbody = document.querySelector('tbody') as HTMLElement;
    const rows = within(tbody).getAllByRole('row');
    await user.click(rows[0]);
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
    expect(screen.getByTestId('detail-panel')).toHaveTextContent('RAT-1');
  });

  it('should close the detail panel when the same row is clicked again', async () => {
    const user = userEvent.setup();
    render();
    const tbody = document.querySelector('tbody') as HTMLElement;
    const firstRow = within(tbody).getAllByRole('row')[0];
    await user.click(firstRow);
    // After first click the component re-renders into SplitPane; re-query the row
    const tbody2 = document.querySelector('tbody') as HTMLElement;
    const firstRowAgain = within(tbody2).getAllByRole('row')[0];
    await user.click(firstRowAgain);
    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument();
  });

  it('should disable the Archive Done button when no tickets are in DONE state', () => {
    setupMocks(fixturesNoDone);
    render();
    const btn = screen.getByRole('button', { name: /archive done tickets/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'No done tickets to archive');
  });

  it('should enable the Archive Done button when at least one DONE ticket exists', () => {
    render();
    const btn = screen.getByRole('button', { name: /archive done tickets/i });
    expect(btn).not.toBeDisabled();
  });

  it('should show the confirmation modal when Archive Done is clicked', async () => {
    const user = userEvent.setup();
    render();
    const btn = screen.getByRole('button', { name: /archive done tickets/i });
    await user.click(btn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Archive Done Tickets' })).toBeInTheDocument();
  });
});
