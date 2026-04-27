// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/ticketMutations', () => ({
  useCreateTicket: vi.fn(),
}));
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return { ...actual, useTickets: vi.fn() };
});

import { useCreateTicket } from '../lib/ticketMutations';
import { useTickets } from '../lib/api';
import { CreateTicketModal } from './CreateTicketModal';
import { makeTicketSummary } from '../test/factories';

function renderModal(props: { open: boolean; onClose?: () => void; projectName?: string }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CreateTicketModal
          open={props.open}
          onClose={props.onClose ?? vi.fn()}
          projectName={props.projectName ?? 'ratatoskr'}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeMutation({
  mutateAsync = vi.fn().mockResolvedValue({ displayId: 'RAT-1', number: 1 }),
  isPending = false,
} = {}) {
  return { mutateAsync, isPending, mutate: vi.fn(), error: null, data: undefined, reset: vi.fn(), status: 'idle' as const };
}

beforeEach(() => {
  vi.mocked(useTickets).mockReturnValue({ data: [], isLoading: false } as never);
  vi.mocked(useCreateTicket).mockReturnValue(makeMutation() as never);
});

describe('CreateTicketModal', () => {
  it('should not render when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should render type, title, state, and body fields when open', () => {
    renderModal({ open: true });
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    expect(screen.getByLabelText('Body')).toBeInTheDocument();
  });

  it('should hide the epic field when type is Epic', async () => {
    const user = userEvent.setup();
    renderModal({ open: true });
    await user.selectOptions(screen.getByLabelText('Type'), 'Epic');
    expect(screen.queryByLabelText(/Epic \(optional\)/i)).toBeNull();
  });

  it('should show the epic field when type is Task or Bug', async () => {
    const user = userEvent.setup();
    renderModal({ open: true });
    // default is Task
    expect(screen.getByLabelText(/Epic \(optional\)/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Type'), 'Bug');
    expect(screen.getByLabelText(/Epic \(optional\)/i)).toBeInTheDocument();
  });

  it('should scaffold the body from the title when the user has not touched the body', async () => {
    const user = userEvent.setup();
    renderModal({ open: true });
    await user.type(screen.getByLabelText('Title'), 'my title');
    const body = screen.getByLabelText('Body') as HTMLTextAreaElement;
    expect(body.value).toContain('# my title');
    expect(body.value).toContain('## Description');
  });

  it('should not overwrite the body once the user has edited it', async () => {
    const user = userEvent.setup();
    renderModal({ open: true });
    await user.type(screen.getByLabelText('Body'), 'custom body');
    await user.type(screen.getByLabelText('Title'), 'any title');
    const body = screen.getByLabelText('Body') as HTMLTextAreaElement;
    expect(body.value).toBe('custom body');
  });

  it('should call the create mutation with correct payload on submit', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ displayId: 'RAT-1', number: 1 });
    vi.mocked(useCreateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);
    renderModal({ open: true });
    await user.type(screen.getByLabelText('Title'), 'New ticket');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Task', title: 'New ticket' }),
    );
  });

  it('should display an inline error banner when the mutation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(useCreateTicket).mockReturnValue(
      makeMutation({ mutateAsync: vi.fn().mockRejectedValue(new Error('boom')) }) as never,
    );
    renderModal({ open: true });
    await user.type(screen.getByLabelText('Title'), 'some title');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('should reset all fields when cancelled', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ open: true, onClose });
    await user.type(screen.getByLabelText('Title'), 'my title');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });

  it('should render the dependency editor by default (Task type)', () => {
    renderModal({ open: true });
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
  });

  it('should hide the dependency editor when type is changed to Epic', async () => {
    const user = userEvent.setup();
    renderModal({ open: true });
    await user.selectOptions(screen.getByLabelText('Type'), 'Epic');
    expect(screen.queryByText('Dependencies')).not.toBeInTheDocument();
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
    renderModal({ open: true });
    const combobox = screen.getByLabelText(/epic \(optional\)/i);
    await user.click(combobox);
    const finishedOption = screen.getByRole('option', { name: /Finished/ });
    const activeOption = screen.getByRole('option', { name: /Active/ });
    expect(finishedOption).toHaveAttribute('aria-disabled', 'true');
    expect(activeOption).not.toHaveAttribute('aria-disabled', 'true');
  });
});

describe('CreateTicketModal — dependency persistence', () => {
  const pickerTicket = makeTicketSummary({ number: 10, displayId: 'RAT-10', title: 'Another ticket', type: 'Task' });

  beforeEach(() => {
    vi.mocked(useTickets).mockReturnValue({ data: [pickerTicket], isLoading: false } as never);
    vi.mocked(useCreateTicket).mockReturnValue(makeMutation() as never);
  });

  it.each([
    { relationship: 'is blocked by', payloadKey: 'blocked_by' },
    { relationship: 'blocks', payloadKey: 'blocks' },
  ])(
    'should include $payloadKey in the POST payload when the user adds a dependency via picker',
    async ({ relationship, payloadKey }) => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({ displayId: 'RAT-2', number: 2 });
      vi.mocked(useCreateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);

      renderModal({ open: true });

      await user.type(screen.getByLabelText('Title'), 'My new ticket');

      if (relationship !== 'is blocked by') {
        await user.selectOptions(screen.getByDisplayValue('is blocked by'), relationship);
      }
      await user.click(screen.getByPlaceholderText('Search tickets…'));
      await user.click(screen.getByText('Another ticket'));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      await user.click(screen.getByRole('button', { name: 'Create' }));

      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ [payloadKey]: ['RAT-10'] }),
      );
    },
  );

  it('should NOT include blocked_by/blocks when both arrays are empty', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ displayId: 'RAT-2', number: 2 });
    vi.mocked(useCreateTicket).mockReturnValue(makeMutation({ mutateAsync }) as never);

    renderModal({ open: true });
    await user.type(screen.getByLabelText('Title'), 'My new ticket');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    const call = mutateAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('blocked_by');
    expect(call).not.toHaveProperty('blocks');
  });

  it('should display the server\'s invalid-input message in the error banner when the POST rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(useCreateTicket).mockReturnValue(
      makeMutation({ mutateAsync: vi.fn().mockRejectedValue(new Error('Referenced ticket RAT-9999 not found')) }) as never,
    );

    renderModal({ open: true });
    await user.type(screen.getByLabelText('Title'), 'My new ticket');
    await user.click(screen.getByPlaceholderText('Search tickets…'));
    await user.click(screen.getByText('Another ticket'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Referenced ticket RAT-9999 not found')).toBeInTheDocument();
  });
});
