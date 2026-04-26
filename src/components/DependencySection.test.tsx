// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeTicketSummary } from '../test/factories';
import { renderWithProviders } from '../test/renderWithProviders';
import { DependencySection } from './DependencySection';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    useTickets: () => ({
      data: [
        makeTicketSummary({ number: 5, displayId: 'RAT-5', state: 'IN_PROGRESS' }),
        makeTicketSummary({ number: 12, displayId: 'RAT-12', state: 'IN_PROGRESS' }),
        makeTicketSummary({ number: 7, displayId: 'RAT-7', state: 'IN_PROGRESS' }),
      ],
    }),
  };
});

const defaultProps = {
  projectName: 'ratatoskr',
  currentPrefix: 'RAT',
};

describe('DependencySection', () => {
  beforeEach(() => mockNavigate.mockReset());

  it('should render nothing when both blockedBy and blocks are empty', () => {
    renderWithProviders(
      <DependencySection {...defaultProps} blockedBy={[]} blocks={[]} />,
    );
    expect(screen.queryByText(/Blocked by:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Blocks:/)).not.toBeInTheDocument();
  });

  it('should render a chip per blockedBy entry under the "Blocked by" label', () => {
    renderWithProviders(
      <DependencySection {...defaultProps} blockedBy={['RAT-5', 'RAT-7']} blocks={[]} />,
    );
    expect(screen.getByText('Blocked by')).toBeInTheDocument();
    expect(screen.getByText('RAT-5')).toBeInTheDocument();
    expect(screen.getByText('RAT-7')).toBeInTheDocument();
  });

  it('should render a chip per blocks entry under the "Blocks" label', () => {
    renderWithProviders(
      <DependencySection {...defaultProps} blockedBy={[]} blocks={['RAT-12']} />,
    );
    expect(screen.getByText('Blocks')).toBeInTheDocument();
    expect(screen.getByText('RAT-12')).toBeInTheDocument();
  });

  it('should not render the "Blocks" row when blocks is empty', () => {
    renderWithProviders(
      <DependencySection {...defaultProps} blockedBy={['RAT-5']} blocks={[]} />,
    );
    expect(screen.getByText('Blocked by')).toBeInTheDocument();
    expect(screen.queryByText('Blocks')).not.toBeInTheDocument();
  });

  it('should navigate to the ticket detail when a same-project chip is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DependencySection {...defaultProps} blockedBy={['RAT-5']} blocks={[]} />,
    );
    await user.click(screen.getByRole('button', { name: 'RAT-5' }));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/ratatoskr/tickets?inspect=RAT-5');
  });

  it('should not navigate and show Archived title when a same-project archived chip is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      // RAT-99 is not in the mocked useTickets list → treated as archived
      <DependencySection {...defaultProps} blockedBy={['RAT-99']} blocks={[]} />,
    );
    const chip = screen.getByText('RAT-99');
    expect(chip).toHaveAttribute('title', 'Archived');
    await user.click(chip);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate when a cross-project chip is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DependencySection {...defaultProps} blockedBy={['MUN-1']} blocks={[]} />,
    );
    await user.click(screen.getByText('MUN-1'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should stop click propagation so a parent onClick is not invoked', async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();
    renderWithProviders(
      <div onClick={parentClick}>
        <DependencySection {...defaultProps} blockedBy={['RAT-5']} blocks={[]} />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'RAT-5' }));
    expect(parentClick).not.toHaveBeenCalled();
  });
});
