// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ArchivedTicketRecord } from '../../server/types';
import { renderWithProviders } from '../test/renderWithProviders';
import { ArchiveTab } from './ArchiveTab';

vi.mock('../lib/api', () => ({
  useArchive: vi.fn(),
}));

vi.mock('../lib/ticketMutations', () => ({
  useUnarchiveTicket: vi.fn(),
}));

import { useArchive } from '../lib/api';
import { useUnarchiveTicket } from '../lib/ticketMutations';

const mockUseArchive = vi.mocked(useArchive);
const mockUseUnarchiveTicket = vi.mocked(useUnarchiveTicket);

const records: ArchivedTicketRecord[] = [
  { number: 1, displayId: 'RAT-1', type: 'Task', title: 'Alpha ticket', state: 'DONE', body: '', created: '', updated: '', archived: '2026-04-01T10:00:00Z', blocks: [], blockedBy: [] },
  { number: 2, displayId: 'RAT-2', type: 'Task', title: 'Beta ticket', state: 'DONE', body: '', created: '', updated: '', archived: '2026-04-02T10:00:00Z', blocks: [], blockedBy: [] },
  { number: 3, displayId: 'RAT-3', type: 'Bug', title: 'Gamma bug', state: 'DONE', body: '', created: '', updated: '', archived: '2026-04-03T10:00:00Z', blocks: [], blockedBy: [] },
];

const mutateFn = vi.fn();

function setupMocks(data = records) {
  mockUseArchive.mockReturnValue({ data, isLoading: false, error: null } as ReturnType<typeof useArchive>);
  mockUseUnarchiveTicket.mockReturnValue({ mutate: mutateFn, isPending: false, variables: undefined } as unknown as ReturnType<typeof useUnarchiveTicket>);
}

function render() {
  return renderWithProviders(<ArchiveTab />);
}

describe('ArchiveTab', () => {
  beforeEach(() => {
    mutateFn.mockReset();
    setupMocks();
  });

  it('should render a row for each archived ticket', () => {
    render();
    const tbody = document.querySelector('tbody') as HTMLElement;
    const rows = within(tbody).getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('should filter rows when the user types in the search box', async () => {
    const user = userEvent.setup();
    render();
    const input = screen.getByPlaceholderText(/search by title/i);
    await user.type(input, 'alpha');
    expect(screen.getByText('Alpha ticket')).toBeInTheDocument();
    expect(screen.queryByText('Beta ticket')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma bug')).not.toBeInTheDocument();
  });

  it('should clear the search when the clear button is clicked', async () => {
    const user = userEvent.setup();
    render();
    const input = screen.getByPlaceholderText(/search by title/i);
    await user.type(input, 'alpha');
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearBtn);
    expect(input).toHaveValue('');
    expect(screen.getByText('Beta ticket')).toBeInTheDocument();
    expect(screen.getByText('Gamma bug')).toBeInTheDocument();
  });

  it('should show an empty-results message when nothing matches the filter', async () => {
    const user = userEvent.setup();
    render();
    const input = screen.getByPlaceholderText(/search by title/i);
    await user.type(input, 'zzznomatch');
    expect(screen.getByText(/no tickets match/i)).toBeInTheDocument();
  });

  it('should call the unarchive mutation when the Unarchive button is clicked', async () => {
    const user = userEvent.setup();
    render();
    const buttons = screen.getAllByRole('button', { name: /unarchive/i });
    await user.click(buttons[0]);
    expect(mutateFn).toHaveBeenCalledWith(1);
  });
});
