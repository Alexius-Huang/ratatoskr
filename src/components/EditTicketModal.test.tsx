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

  it('should only include changed fields in the PATCH payload', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ ...baseTicket, title: 'New title' });
    vi.mocked(useUpdateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);
    renderModal({});
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'New title');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutateAsync).toHaveBeenCalledWith({ title: 'New title' });
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

  it('should disable DONE epic options in the Epic picker', () => {
    vi.mocked(useTickets).mockReturnValue({
      data: [
        { number: 1, displayId: 'RAT-1', type: 'Epic', title: 'Active', state: 'IN_PROGRESS', created: '', updated: '' },
        { number: 2, displayId: 'RAT-2', type: 'Epic', title: 'Finished', state: 'DONE', created: '', updated: '' },
      ],
      isLoading: false,
    } as never);
    renderModal({});
    const select = screen.getByLabelText(/epic \(optional\)/i) as HTMLSelectElement;
    const options = Array.from(select.options);
    const finishedOption = options.find((o) => o.text.includes('Finished'));
    const activeOption = options.find((o) => o.text.includes('Active'));
    expect(finishedOption?.disabled).toBe(true);
    expect(activeOption?.disabled).toBe(false);
  });
});
