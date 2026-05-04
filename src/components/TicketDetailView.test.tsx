// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTicketDetail } from '../test/factories';
import { renderWithProviders } from '../test/renderWithProviders';
import { TicketDetailView } from './TicketDetailView';
import { useMergePullRequest, MergeError } from '../lib/mergePullRequest';

vi.mock('./EditTicketModal', () => ({ EditTicketModal: () => null }));
vi.mock('./MarkdownBody', () => ({ MarkdownBody: () => null }));
vi.mock('../lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock('../lib/mergePullRequest', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/mergePullRequest')>();
  return { ...real, useMergePullRequest: vi.fn() };
});

const mockMutate = vi.fn();

beforeEach(() => {
  mockMutate.mockReset();
  vi.mocked(useMergePullRequest).mockReturnValue({
    mutate: mockMutate,
    isPending: false,
    isSuccess: false,
    error: null,
  } as unknown as ReturnType<typeof useMergePullRequest>);
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

describe('TicketDetailView — Merge integration', () => {
  it('calls merge.mutate with parsed target on direct click (is_reviewed: true)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({
          pullRequests: [{ url: 'https://github.com/o/r/pull/1', number: 1, title: 'fix', state: 'OPEN' }],
          isReviewed: true,
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Merge pull request' }));
    expect(mockMutate).toHaveBeenCalledOnce();
    expect(mockMutate).toHaveBeenCalledWith({ owner: 'o', repo: 'r', pullNumber: 1 });
  });

  it('calls merge.mutate via dialog confirm (is_reviewed: false)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({
          pullRequests: [{ url: 'https://github.com/o/r/pull/1', number: 1, title: 'fix', state: 'OPEN' }],
          isReviewed: false,
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Merge pull request' }));
    expect(screen.getByText('This PR has not been AI-reviewed. Merge anyway?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Merge' }));
    expect(mockMutate).toHaveBeenCalledOnce();
    expect(mockMutate).toHaveBeenCalledWith({ owner: 'o', repo: 'r', pullNumber: 1 });
  });

  it('renders inline error message when merge.error is set', () => {
    const err = new MergeError('no-token');
    vi.mocked(useMergePullRequest).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      error: err,
    } as unknown as ReturnType<typeof useMergePullRequest>);
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({
          pullRequests: [{ url: 'https://github.com/o/r/pull/1', number: 1, title: 'fix', state: 'OPEN' }],
        })}
      />,
    );
    expect(screen.getByText('GitHub token not configured. Open Settings to add one.')).toBeInTheDocument();
  });

  it.each([
    { isPending: true,  isSuccess: false, expectedLabel: 'Merging…', disabled: true },
    { isPending: false, isSuccess: true,  expectedLabel: 'Merged',   disabled: true },
  ])('button shows "$expectedLabel" and disabled=$disabled when isPending=$isPending isSuccess=$isSuccess', ({ isPending, isSuccess, expectedLabel, disabled }) => {
    vi.mocked(useMergePullRequest).mockReturnValue({
      mutate: mockMutate,
      isPending,
      isSuccess,
      error: null,
    } as unknown as ReturnType<typeof useMergePullRequest>);
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail({
          pullRequests: [{ url: 'https://github.com/o/r/pull/1', number: 1, title: 'fix', state: 'OPEN' }],
        })}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Merge pull request' });
    expect(btn).toHaveTextContent(expectedLabel);
    if (disabled) expect(btn).toBeDisabled();
  });
});

describe('TicketDetailView — launchError', () => {
  it('should render the launch error block when launchError is set', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail()}
        launchError="iTerm2 launching is only supported on macOS (platform: win32)."
      />,
    );
    expect(
      screen.getByText('iTerm2 launching is only supported on macOS (platform: win32).'),
    ).toBeInTheDocument();
  });

  it('should not render the launch error block when launchError is null', () => {
    renderWithProviders(
      <TicketDetailView
        {...defaultProps}
        data={makeTicketDetail()}
        launchError={null}
      />,
    );
    expect(screen.queryByText(/iTerm2/)).not.toBeInTheDocument();
  });
});
