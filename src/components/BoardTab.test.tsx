// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TicketSummary } from '../../server/types';
import { renderWithProviders } from '../test/renderWithProviders';
import { BoardTab } from './BoardTab';

vi.mock('../lib/api', () => ({
  useBoardConfig: vi.fn(),
  useTickets: vi.fn(),
}));

vi.mock('../lib/ticketMutations', () => ({
  useArchiveDoneTickets: vi.fn(),
  useTransitionTicketState: vi.fn(),
}));

vi.mock('./CreateTicketModal', () => ({
  CreateTicketModal: () => null,
}));

vi.mock('./EpicSearchFilter', () => ({
  EpicSearchFilter: ({
    epics,
    activeEpicNumber,
    onEpicChange,
  }: {
    epics: TicketSummary[];
    activeEpicNumber: number | null;
    onEpicChange: (n: number | null) => void;
  }) => (
    <div>
      <input
        aria-label="Filter by epic"
        onChange={(e) => {
          const match = epics.find((ep) => ep.title.toLowerCase().includes(e.target.value.toLowerCase()));
          onEpicChange(match ? match.number : null);
        }}
      />
      {activeEpicNumber !== null && (
        <button
          type="button"
          aria-pressed
          onClick={() => onEpicChange(null)}
        >
          {epics.find((ep) => ep.number === activeEpicNumber)?.title ?? String(activeEpicNumber)}
        </button>
      )}
    </div>
  ),
}));

vi.mock('./BoardColumn', () => ({
  BoardColumn: ({
    state,
    tickets,
    onCardClick,
  }: {
    state: string;
    tickets: TicketSummary[];
    onCardClick?: (ticket: TicketSummary) => void;
  }) => (
    <section data-testid={`col-${state}`}>
      {tickets.map((t) => (
        <div
          key={t.number}
          data-testid={`card-${t.number}`}
          onClick={() => onCardClick?.(t)}
          role="button"
        >
          {t.displayId}
        </div>
      ))}
    </section>
  ),
}));

vi.mock('./TicketDetailModal', () => ({
  TicketDetailModal: ({
    displayId,
    onClose,
  }: {
    displayId: string;
    onClose: () => void;
  }) => (
    <div data-testid="ticket-modal" data-display-id={displayId}>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

import { useBoardConfig, useTickets } from '../lib/api';
import { useArchiveDoneTickets, useTransitionTicketState } from '../lib/ticketMutations';

const mockUseBoardConfig = vi.mocked(useBoardConfig);
const mockUseTickets = vi.mocked(useTickets);
const mockUseArchiveDoneTickets = vi.mocked(useArchiveDoneTickets);
const mockUseTransitionTicketState = vi.mocked(useTransitionTicketState);

const epic1 = { number: 10, displayId: 'RAT-10', type: 'Epic' as const, title: 'Epic one', state: 'IN_PROGRESS' as const, created: '', updated: '' };
const epic2 = { number: 11, displayId: 'RAT-11', type: 'Epic' as const, title: 'Epic two', state: 'IN_PROGRESS' as const, created: '', updated: '' };

const tasks: TicketSummary[] = [
  { number: 1, displayId: 'RAT-1', type: 'Task', title: 'Ready task', state: 'READY', epic: 10, created: '', updated: '', blocks: [], blockedBy: [] },
  { number: 2, displayId: 'RAT-2', type: 'Task', title: 'In progress task', state: 'IN_PROGRESS', epic: 10, created: '', updated: '', blocks: [], blockedBy: [] },
  { number: 3, displayId: 'RAT-3', type: 'Task', title: 'In review task', state: 'IN_REVIEW', epic: 11, created: '', updated: '', blocks: [], blockedBy: [] },
  { number: 4, displayId: 'RAT-4', type: 'Task', title: 'Done task', state: 'DONE', epic: 11, created: '', updated: '', blocks: [], blockedBy: [] },
];

const tasksNoDone: TicketSummary[] = tasks.filter((t) => t.state !== 'DONE');

function setupMocks(taskList = tasks) {
  mockUseBoardConfig.mockReturnValue({ data: { columns: ['READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] }, isLoading: false, error: null } as ReturnType<typeof useBoardConfig>);
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

  it('should filter tickets by epic when a matching chip is selected', async () => {
    const user = userEvent.setup();
    render();
    const input = screen.getByRole('textbox', { name: /filter by epic/i });
    await user.type(input, 'two');
    // epic2 tickets: RAT-3 (IN_REVIEW), RAT-4 (DONE)
    expect(screen.queryByTestId('card-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('card-3')).toBeInTheDocument();
    expect(screen.getByTestId('card-4')).toBeInTheDocument();
  });

  it('should show all tickets when the active epic chip is clicked again', async () => {
    const user = userEvent.setup();
    render();
    const input = screen.getByRole('textbox', { name: /filter by epic/i });
    await user.type(input, 'two');
    const activeChip = screen.getByRole('button', { name: /epic two/i });
    await user.click(activeChip);
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

  it('should open TicketDetailModal when a card is clicked', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByTestId('card-1'));
    const modal = screen.getByTestId('ticket-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute('data-display-id', 'RAT-1');
  });

  it('should show TicketDetailModal with correct displayId when a card is clicked', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByTestId('card-2'));
    const modal = screen.getByTestId('ticket-modal');
    expect(modal).toHaveAttribute('data-display-id', 'RAT-2');
  });

  it('should close TicketDetailModal and clear inspect param when onClose is called', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BoardTab />, {
      initialEntries: ['/projects/ratatoskr/board?inspect=RAT-1'],
    });
    expect(screen.getByTestId('ticket-modal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTestId('ticket-modal')).not.toBeInTheDocument();
    expect(window.location.search).not.toContain('inspect');
  });

  it('should open TicketDetailModal when inspect param is in the URL on mount', () => {
    renderWithProviders(<BoardTab />, {
      initialEntries: ['/projects/ratatoskr/board?inspect=RAT-1'],
    });
    const modal = screen.getByTestId('ticket-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute('data-display-id', 'RAT-1');
  });
});
