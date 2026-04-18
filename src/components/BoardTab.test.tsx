// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TicketSummary } from '../../server/types';
import { renderWithProviders } from '../test/renderWithProviders';
import { BoardTab } from './BoardTab';

vi.mock('../lib/api', () => ({
  useTickets: vi.fn(),
}));

vi.mock('../lib/ticketMutations', () => ({
  useArchiveDoneTickets: vi.fn(),
  useTransitionTicketState: vi.fn(),
}));

vi.mock('./CreateTicketModal', () => ({
  CreateTicketModal: () => null,
}));

vi.mock('./BoardColumn', () => ({
  BoardColumn: ({ state, tickets }: { state: string; tickets: TicketSummary[] }) => (
    <section data-testid={`col-${state}`}>
      {tickets.map((t) => (
        <div key={t.number} data-testid={`card-${t.number}`}>
          {t.displayId}
        </div>
      ))}
    </section>
  ),
}));

import { useTickets } from '../lib/api';
import { useArchiveDoneTickets, useTransitionTicketState } from '../lib/ticketMutations';

const mockUseTickets = vi.mocked(useTickets);
const mockUseArchiveDoneTickets = vi.mocked(useArchiveDoneTickets);
const mockUseTransitionTicketState = vi.mocked(useTransitionTicketState);

const epic1 = { number: 10, displayId: 'RAT-10', type: 'Epic' as const, title: 'Epic one', state: 'IN_PROGRESS' as const, created: '', updated: '' };
const epic2 = { number: 11, displayId: 'RAT-11', type: 'Epic' as const, title: 'Epic two', state: 'IN_PROGRESS' as const, created: '', updated: '' };

const tasks: TicketSummary[] = [
  { number: 1, displayId: 'RAT-1', type: 'Task', title: 'Ready task', state: 'READY', epic: 10, created: '', updated: '' },
  { number: 2, displayId: 'RAT-2', type: 'Task', title: 'In progress task', state: 'IN_PROGRESS', epic: 10, created: '', updated: '' },
  { number: 3, displayId: 'RAT-3', type: 'Task', title: 'In review task', state: 'IN_REVIEW', epic: 11, created: '', updated: '' },
  { number: 4, displayId: 'RAT-4', type: 'Task', title: 'Done task', state: 'DONE', epic: 11, created: '', updated: '' },
];

const tasksNoDone: TicketSummary[] = tasks.filter((t) => t.state !== 'DONE');

function setupMocks(taskList = tasks) {
  mockUseTickets.mockImplementation((_name, type) => {
    if (Array.isArray(type)) {
      return { data: taskList, isLoading: false, error: null } as ReturnType<typeof useTickets>;
    }
    return { data: [epic1, epic2], isLoading: false, error: null } as ReturnType<typeof useTickets>;
  });
  mockUseArchiveDoneTickets.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null } as unknown as ReturnType<typeof useArchiveDoneTickets>);
  mockUseTransitionTicketState.mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useTransitionTicketState>);
}

function render() {
  return renderWithProviders(<BoardTab />);
}

describe('BoardTab', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('should bucket tickets into the correct state columns', () => {
    render();
    expect(within(screen.getByTestId('col-READY')).getByTestId('card-1')).toBeInTheDocument();
    expect(within(screen.getByTestId('col-IN_PROGRESS')).getByTestId('card-2')).toBeInTheDocument();
    expect(within(screen.getByTestId('col-IN_REVIEW')).getByTestId('card-3')).toBeInTheDocument();
    expect(within(screen.getByTestId('col-DONE')).getByTestId('card-4')).toBeInTheDocument();
  });

  it('should filter tickets by epic when an epic is selected', async () => {
    const user = userEvent.setup();
    render();
    const select = screen.getByRole('combobox', { name: /epic/i });
    await user.selectOptions(select, String(epic2.number));
    // epic2 tickets: RAT-3 (IN_REVIEW), RAT-4 (DONE)
    expect(screen.queryByTestId('card-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('card-3')).toBeInTheDocument();
    expect(screen.getByTestId('card-4')).toBeInTheDocument();
  });

  it('should show all tickets when epic filter is set to All', async () => {
    const user = userEvent.setup();
    render();
    const select = screen.getByRole('combobox', { name: /epic/i });
    await user.selectOptions(select, String(epic2.number));
    await user.selectOptions(select, 'all');
    expect(screen.getByTestId('card-1')).toBeInTheDocument();
    expect(screen.getByTestId('card-2')).toBeInTheDocument();
    expect(screen.getByTestId('card-3')).toBeInTheDocument();
    expect(screen.getByTestId('card-4')).toBeInTheDocument();
  });

  it('should disable Archive Done when DONE column is empty', () => {
    setupMocks(tasksNoDone);
    render();
    const btn = screen.getByRole('button', { name: /archive done tickets/i });
    expect(btn).toBeDisabled();
  });

  it('should open the confirmation modal when Archive Done is clicked', async () => {
    const user = userEvent.setup();
    render();
    const btn = screen.getByRole('button', { name: /archive done tickets/i });
    await user.click(btn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Archive Done Tickets' })).toBeInTheDocument();
  });
});
