// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../test/factories';
import { renderWithProviders } from '../test/renderWithProviders';
import { TicketDetailView } from './TicketDetailView';

vi.mock('./EditTicketModal', () => ({ EditTicketModal: () => null }));
vi.mock('./MarkdownBody', () => ({ MarkdownBody: () => null }));
vi.mock('../lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const defaultProps = {
  archiveError: null,
  showEdit: false,
  onCloseEdit: vi.fn(),
  projectName: 'ratatoskr',
  epicLabel: null,
};

describe('TicketDetailView — dependency section', () => {
  it('should render the dependency section when blockedBy is non-empty', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ blockedBy: ['RAT-5'] })}
      />,
    );
    expect(screen.getByText('Blocked by')).toBeInTheDocument();
  });

  it('should render the dependency section when blocks is non-empty', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ blocks: ['RAT-12'] })}
      />,
    );
    expect(screen.getByText('Blocks')).toBeInTheDocument();
  });

  it('should not render the dependency section when both arrays are empty', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail()}
      />,
    );
    expect(screen.queryByText('Blocked by')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocks')).not.toBeInTheDocument();
  });
});

describe('TicketDetailView — AI Reviewed badge', () => {
  it.each([
    { isReviewed: true as const,      visible: true,  label: 'true' },
    { isReviewed: false as const,     visible: false, label: 'false' },
    { isReviewed: undefined,          visible: false, label: 'undefined' },
  ])('isReviewed=$label → badge visible=$visible', ({ isReviewed, visible }) => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ isReviewed, branch: 'feat/x' })}
      />,
    );
    const badge = screen.queryByText('AI Reviewed');
    if (visible) expect(badge).toBeInTheDocument();
    else expect(badge).not.toBeInTheDocument();
  });

  it('renders badge when isReviewed=true even without branch or PR', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ isReviewed: true })}
      />,
    );
    expect(screen.getByText('AI Reviewed')).toBeInTheDocument();
  });
});

describe('TicketDetailView — Merge button visibility', () => {
  it.each([
    { state: 'OPEN',   visible: true,  label: 'OPEN' },
    { state: 'MERGED', visible: false, label: 'MERGED' },
    { state: 'CLOSED', visible: false, label: 'CLOSED' },
  ])('pullRequests state=$label → Merge button visible=$visible', ({ state, visible }) => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({
          pullRequests: [{ url: 'https://github.com/o/r/pull/1', number: 1, title: 'fix', state }],
        })}
      />,
    );
    const btn = screen.queryByRole('button', { name: 'Merge pull request' });
    if (visible) expect(btn).toBeInTheDocument();
    else expect(btn).not.toBeInTheDocument();
  });

  it('shows Merge button for legacy prs', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({ prs: ['Alexius-Huang/ratatoskr/pull/42'] })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Merge pull request' })).toBeInTheDocument();
  });

  it('does not show Merge button when no PRs and no branch', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Merge pull request' })).not.toBeInTheDocument();
  });
});

describe('TicketDetailView — Merge button click behavior', () => {
  it.each([
    { isReviewed: false as const,     dialogShown: true,  label: 'false' },
    { isReviewed: undefined,          dialogShown: true,  label: 'undefined' },
    { isReviewed: true as const,      dialogShown: false, label: 'true' },
  ])('isReviewed=$label → confirmation dialog shown=$dialogShown', async ({ isReviewed, dialogShown }) => {
    const user = userEvent.setup();
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({
          pullRequests: [{ url: 'https://github.com/o/r/pull/1', number: 1, title: 'fix', state: 'OPEN' }],
          isReviewed,
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Merge pull request' }));
    const dialog = screen.queryByText('This PR has not been AI-reviewed. Merge anyway?');
    if (dialogShown) expect(dialog).toBeInTheDocument();
    else expect(dialog).not.toBeInTheDocument();
  });
});
