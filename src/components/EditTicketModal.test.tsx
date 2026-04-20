// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { TicketDetail } from '../../server/types';

vi.mock('../lib/ticketMutations', () => ({
  useUpdateTicket: vi.fn(),
}));
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, useTickets: vi.fn() };
});

import { useUpdateTicket } from '../lib/ticketMutations';
import { useTickets } from '../lib/api';
import { EditTicketModal } from './EditTicketModal';

const baseTicket: TicketDetail = {
  number: 5,
  displayId: 'RAT-5',
  type: 'Task',
  title: 'Old title',
  state: 'IN_PROGRESS',
  epic: 1,
  body: 'old body',
  created: '2026-04-18T00:00:00Z',
  updated: '2026-04-18T00:00:00Z',
};

function renderModal(props: {
  open?: boolean;
  onClose?: () => void;
  ticket?: TicketDetail;
  projectName?: string;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EditTicketModal
          open={props.open ?? true}
          onClose={props.onClose ?? vi.fn()}
          projectName={props.projectName ?? 'ratatoskr'}
          ticket={props.ticket ?? baseTicket}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeMutation({
  mutateAsync = vi.fn().mockResolvedValue({ ...baseTicket }),
  isPending = false,
} = {}) {
  return { mutateAsync, isPending, mutate: vi.fn(), error: null, data: undefined, reset: vi.fn(), status: 'idle' as const };
}

beforeEach(() => {
  vi.mocked(useTickets).mockReturnValue({ data: [], isLoading: false } as never);
  vi.mocked(useUpdateTicket).mockReturnValue(makeMutation() as never);
});

describe('EditTicketModal', () => {
  it('should pre-fill all fields from the ticket prop', () => {
    renderModal({});
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Old title');
    expect((screen.getByLabelText('State') as HTMLSelectElement).value).toBe('IN_PROGRESS');
    expect((screen.getByLabelText('Body') as HTMLTextAreaElement).value).toBe('old body');
  });

  it('should disable the type selector when the ticket is an Epic', () => {
    renderModal({ ticket: { ...baseTicket, type: 'Epic', epic: undefined } });
    expect(screen.getByLabelText('Type')).toBeDisabled();
  });

  it('should only include changed fields in the PATCH payload (plus wont_do_reason: null)', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ ...baseTicket, title: 'New title' });
    vi.mocked(useUpdateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);
    renderModal({});
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'New title');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutateAsync).toHaveBeenCalledWith({ title: 'New title', wont_do_reason: null });
  });

  it('should call the update mutation on submit', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ ...baseTicket });
    vi.mocked(useUpdateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);
    renderModal({});
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated title');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('should display an inline error banner when the mutation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(useUpdateTicket).mockReturnValue(
      makeMutation({ mutateAsync: vi.fn().mockRejectedValue(new Error('boom')) }) as never,
    );
    renderModal({});
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Changed');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('should not call the mutation when cancelled', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn();
    vi.mocked(useUpdateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);
    const onClose = vi.fn();
    renderModal({ onClose });
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Changed title');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the reason textarea when state is changed to WONT_DO', async () => {
    const user = userEvent.setup();
    renderModal({});
    const stateSelect = screen.getByLabelText('State') as HTMLSelectElement;
    await user.selectOptions(stateSelect, 'WONT_DO');
    expect(screen.getByPlaceholderText(/why won't this be done/i)).toBeDefined();
  });

  it('disables Save when state is WONT_DO and reason is empty', async () => {
    const user = userEvent.setup();
    renderModal({});
    await user.selectOptions(screen.getByLabelText('State') as HTMLSelectElement, 'WONT_DO');
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeDisabled();
  });

  it('enables Save when WONT_DO and reason is non-empty', async () => {
    const user = userEvent.setup();
    renderModal({});
    await user.selectOptions(screen.getByLabelText('State') as HTMLSelectElement, 'WONT_DO');
    await user.type(screen.getByPlaceholderText(/why won't this be done/i), 'Out of scope.');
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('submits with wont_do_reason when state is WONT_DO', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ ...baseTicket, state: 'WONT_DO' });
    vi.mocked(useUpdateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);
    renderModal({});
    await user.selectOptions(screen.getByLabelText('State') as HTMLSelectElement, 'WONT_DO');
    await user.type(screen.getByPlaceholderText(/why won't this be done/i), 'Dropped.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'WONT_DO', wont_do_reason: 'Dropped.' }),
    );
  });

  it('pre-fills reason when editing a ticket already in WONT_DO', () => {
    renderModal({ ticket: { ...baseTicket, state: 'WONT_DO', wontDoReason: 'Was never needed.' } });
    const reasonInput = screen.getByPlaceholderText(/why won't this be done/i) as HTMLTextAreaElement;
    expect(reasonInput.value).toBe('Was never needed.');
  });

  it('sends wont_do_reason: null when switching away from WONT_DO', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ ...baseTicket, state: 'READY' });
    vi.mocked(useUpdateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);
    renderModal({ ticket: { ...baseTicket, state: 'WONT_DO', wontDoReason: 'old reason' } });
    await user.selectOptions(screen.getByLabelText('State') as HTMLSelectElement, 'READY');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'READY', wont_do_reason: null }),
    );
  });

  it('should render DONE epics as non-selectable in the Epic picker', async () => {
    const user = userEvent.setup();
    vi.mocked(useTickets).mockReturnValue({
      data: [
        { number: 1, displayId: 'RAT-1', type: 'Epic', title: 'Active', state: 'IN_PROGRESS', created: '', updated: '' },
        { number: 2, displayId: 'RAT-2', type: 'Epic', title: 'Finished', state: 'DONE', created: '', updated: '' },
      ],
      isLoading: false,
    } as never);
    renderModal({});
    const combobox = screen.getByLabelText(/epic \(optional\)/i);
    await user.click(combobox);
    const finishedOption = screen.getByRole('option', { name: /Finished/ });
    const activeOption = screen.getByRole('option', { name: /Active/ });
    expect(finishedOption).toHaveAttribute('aria-disabled', 'true');
    expect(activeOption).not.toHaveAttribute('aria-disabled', 'true');
  });
});
