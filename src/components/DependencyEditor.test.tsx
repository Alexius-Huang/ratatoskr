// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTicketSummary } from '../test/factories';
import { renderWithProviders } from '../test/renderWithProviders';
import { DependencyEditor } from './DependencyEditor';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    useTickets: () => ({
      data: [
        makeTicketSummary({ number: 1, displayId: 'RAT-1', title: 'Alpha ticket' }),
        makeTicketSummary({ number: 2, displayId: 'RAT-2', title: 'Beta ticket' }),
        makeTicketSummary({ number: 3, displayId: 'RAT-3', title: 'Gamma ticket' }),
        makeTicketSummary({ number: 4, displayId: 'RAT-4', title: 'Epic ticket', type: 'Epic' }),
      ],
    }),
  };
});

const onBlockedByChange = vi.fn();
const onBlocksChange = vi.fn();

const defaultProps = {
  projectName: 'ratatoskr',
  blockedBy: [] as string[],
  blocks: [] as string[],
  onBlockedByChange,
  onBlocksChange,
};

describe('DependencyEditor', () => {
  beforeEach(() => {
    onBlockedByChange.mockReset();
    onBlocksChange.mockReset();
  });

  it('should render the relationship dropdown with both options', () => {
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    const select = screen.getByDisplayValue('is blocked by') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['blocked_by', 'blocks']);
  });

  it('should default the relationship dropdown to "is blocked by"', () => {
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    expect((screen.getByDisplayValue('is blocked by') as HTMLSelectElement).value).toBe('blocked_by');
  });

  it('should filter picker results by displayId substring', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('Search tickets…'), 'RAT-1');
    expect(screen.getByText('Alpha ticket')).toBeInTheDocument();
    expect(screen.queryByText('Beta ticket')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma ticket')).not.toBeInTheDocument();
  });

  it('should filter picker results by title (case-insensitive)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('Search tickets…'), 'beta');
    expect(screen.getByText('Beta ticket')).toBeInTheDocument();
    expect(screen.queryByText('Alpha ticket')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma ticket')).not.toBeInTheDocument();
  });

  it('should exclude currentDisplayId from picker results', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} currentDisplayId="RAT-1" />);
    await user.click(screen.getByPlaceholderText('Search tickets…'));
    expect(screen.queryByText('Alpha ticket')).not.toBeInTheDocument();
    expect(screen.getByText('Beta ticket')).toBeInTheDocument();
    expect(screen.getByText('Gamma ticket')).toBeInTheDocument();
  });

  it('should exclude Epic tickets from picker results', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    await user.click(screen.getByPlaceholderText('Search tickets…'));
    expect(screen.queryByText('Epic ticket')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha ticket')).toBeInTheDocument();
  });

  it('should exclude tickets already in blockedBy or blocks from picker results', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DependencyEditor {...defaultProps} blockedBy={['RAT-1']} blocks={['RAT-2']} />,
    );
    await user.click(screen.getByPlaceholderText('Search tickets…'));
    expect(screen.queryByText('Alpha ticket')).not.toBeInTheDocument();
    expect(screen.queryByText('Beta ticket')).not.toBeInTheDocument();
    expect(screen.getByText('Gamma ticket')).toBeInTheDocument();
  });

  it('should toggle a picker result into the pending set when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    await user.click(screen.getByPlaceholderText('Search tickets…'));
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await user.click(screen.getByText('Alpha ticket'));
    expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
  });

  it('should disable the Confirm button when no pending selections', () => {
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it.each([
    { relationship: 'blocked_by' as const, label: 'is blocked by', expectedFn: onBlockedByChange },
    { relationship: 'blocks' as const, label: 'blocks', expectedFn: onBlocksChange },
  ])('should call the correct handler ($label) with appended IDs on Confirm', async ({ relationship, expectedFn }) => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    if (relationship !== 'blocked_by') {
      await user.selectOptions(screen.getByDisplayValue('is blocked by'), relationship);
    }
    await user.click(screen.getByPlaceholderText('Search tickets…'));
    await user.click(screen.getByText('Alpha ticket'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(expectedFn).toHaveBeenCalledWith(['RAT-1']);
  });

  it('should clear pending, query, and close the picker when the relationship dropdown changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search tickets…');
    await user.type(input, 'alpha');
    await user.click(screen.getByText('Alpha ticket'));
    expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
    await user.selectOptions(screen.getByDisplayValue('is blocked by'), 'blocks');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('should append multiple selected tickets when Confirm is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    await user.click(screen.getByPlaceholderText('Search tickets…'));
    await user.click(screen.getByText('Alpha ticket'));
    await user.click(screen.getByText('Beta ticket'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onBlockedByChange).toHaveBeenCalledWith(['RAT-1', 'RAT-2']);
  });

  it('should append to an existing blockedBy array without duplicates', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} blockedBy={['RAT-2']} />);
    await user.click(screen.getByPlaceholderText('Search tickets…'));
    await user.click(screen.getByText('Alpha ticket'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onBlockedByChange).toHaveBeenCalledWith(['RAT-2', 'RAT-1']);
  });

  it('should clear pending and query after Confirm', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search tickets…');
    await user.type(input, 'alpha');
    await user.click(screen.getByText('Alpha ticket'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('should call onBlockedByChange with the entry removed when × on a Blocked-by tag is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DependencyEditor {...defaultProps} blockedBy={['RAT-1', 'RAT-2']} />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove RAT-1 from blocked by' }));
    expect(onBlockedByChange).toHaveBeenCalledWith(['RAT-2']);
  });

  it('should call onBlocksChange with the entry removed when × on a Blocks tag is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DependencyEditor {...defaultProps} blocks={['RAT-3']} />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove RAT-3 from blocks' }));
    expect(onBlocksChange).toHaveBeenCalledWith([]);
  });

  it('should close the picker without flushing pending when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DependencyEditor {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search tickets…');
    await user.click(input);
    await user.click(screen.getByText('Alpha ticket'));
    await user.keyboard('{Escape}');
    expect(onBlockedByChange).not.toHaveBeenCalled();
    expect(onBlocksChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
  });
});
