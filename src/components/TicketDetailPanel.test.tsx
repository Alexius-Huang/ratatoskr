// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TicketDetail } from '../../server/types';
import { makeTicketDetail } from '../test/factories';
import { renderWithProviders } from '../test/renderWithProviders';
import { TicketDetailPanel } from './TicketDetailPanel';

vi.mock('../lib/api', async (importActual) => {
  const actual = await importActual<typeof import('../lib/api')>();
  return {
    ...actual,
    useTicketDetail: vi.fn(),
    useTicketPlan: vi.fn(),
  };
});

vi.mock('../lib/ticketMutations', () => ({
  useArchiveTicket: vi.fn(),
}));

vi.mock('./EditTicketModal', () => ({
  EditTicketModal: () => null,
}));

vi.mock('./CommentForm', () => ({
  CommentForm: () => <div data-testid="comment-form" />,
}));

vi.mock('../lib/openExternal', () => ({
  openExternal: vi.fn(),
}));

vi.mock('./MarkdownBody', () => ({
  MarkdownBody: ({ source }: { source: string }) => (
    <div data-testid="markdown-body">{source}</div>
  ),
}));

import { useTicketDetail, useTicketPlan } from '../lib/api';
import { openExternal } from '../lib/openExternal';
import { useArchiveTicket } from '../lib/ticketMutations';

const mockUseTicketDetail = vi.mocked(useTicketDetail);
const mockUseTicketPlan = vi.mocked(useTicketPlan);
const mockUseArchiveTicket = vi.mocked(useArchiveTicket);
const mockOpenExternal = vi.mocked(openExternal);

const taskFixture = makeTicketDetail({
  number: 5,
  title: 'My task title',
  state: 'IN_PROGRESS',
  body: 'Task body text',
  planDoc: 'plans/5.md',
});

const epicFixture = makeTicketDetail({
  number: 10,
  type: 'Epic',
  title: 'My epic title',
  state: 'IN_PROGRESS',
  body: 'Epic body text',
  childCounts: {
    total: 3,
    byState: {
      NOT_READY: 0,
      PLANNING: 0,
      READY: 1,
      IN_PROGRESS: 1,
      IN_REVIEW: 0,
      DONE: 1,
      WONT_DO: 0,
    },
  },
});

const archiveMutateFn = vi.fn();
const archiveMutateAsyncFn = vi.fn();

function setupArchiveMock(overrides: Partial<{ isPending: boolean; error: Error | null }> = {}) {
  mockUseArchiveTicket.mockReturnValue({
    mutate: archiveMutateFn,
    mutateAsync: archiveMutateAsyncFn,
    isPending: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useArchiveTicket>);
}

function setupPlanMock(planBody = '') {
  mockUseTicketPlan.mockReturnValue({
    data: { path: 'plans/5.md', body: planBody },
    isLoading: false,
    error: null,
  } as ReturnType<typeof useTicketPlan>);
}

function renderPanel(fixture: TicketDetail = taskFixture) {
  mockUseTicketDetail.mockReturnValue({
    data: fixture,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useTicketDetail>);

  const onClose = vi.fn();
  const result = renderWithProviders(
    <TicketDetailPanel
      projectName="ratatoskr"
      number={fixture.number}
      displayId={fixture.displayId}
      onClose={onClose}
    />,
    { initialEntries: [`/projects/ratatoskr/tickets?inspect=${fixture.displayId}`] },
  );
  return { ...result, onClose };
}

describe('TicketDetailPanel', () => {
  beforeEach(() => {
    archiveMutateFn.mockReset();
    archiveMutateAsyncFn.mockReset();
    mockOpenExternal.mockReset();
    setupArchiveMock();
    setupPlanMock('The plan content');
  });

  it('should render the ticket title and state badge', () => {
    renderPanel();
    expect(screen.getByText('My task title')).toBeInTheDocument();
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
  });

  it('should disable the Archive button with a tooltip when the Epic has non-DONE children', () => {
    renderPanel(epicFixture);
    const archiveBtn = screen.getByRole('button', { name: /archive/i });
    expect(archiveBtn).toBeDisabled();
    expect(archiveBtn).toHaveAttribute('title', expect.stringMatching(/cannot archive/i));
  });

  it('should enable the Archive button for Tasks and Bugs', () => {
    renderPanel(taskFixture);
    const archiveBtn = screen.getByRole('button', { name: /^archive$/i });
    expect(archiveBtn).not.toBeDisabled();
  });

  it('should show the plan view when View Plan is clicked', async () => {
    const user = userEvent.setup();
    renderPanel();
    const viewPlanBtn = screen.getByRole('button', { name: /view plan/i });
    await user.click(viewPlanBtn);
    await waitFor(() => {
      expect(screen.getByTestId('markdown-body')).toHaveTextContent('The plan content');
    });
  });

  it('should return to the ticket view when Back to Ticket is clicked', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: /view plan/i }));
    await waitFor(() => screen.getByRole('button', { name: /back to ticket/i }));
    await user.click(screen.getByRole('button', { name: /back to ticket/i }));
    await waitFor(() => {
      expect(screen.getByText('My task title')).toBeInTheDocument();
    });
  });

  it('should display an error banner when the archive mutation fails', async () => {
    const user = userEvent.setup();
    const archiveError = new Error('boom');
    archiveMutateAsyncFn.mockRejectedValue(archiveError);
    setupArchiveMock({ error: archiveError });
    renderPanel();
    const archiveBtn = screen.getByRole('button', { name: /^archive$/i });
    await user.click(archiveBtn);
    await waitFor(() => {
      expect(screen.getByText(/archive failed.*boom/i)).toBeInTheDocument();
    });
  });

  it('should render the epic tag with inline color when epicColor is present', () => {
    const taskWithColoredEpic: TicketDetail = {
      ...taskFixture,
      epic: 3,
      epicTitle: 'Colored Epic',
      epicColor: '#A3BE8C',
    };
    renderPanel(taskWithColoredEpic);
    const tag = document.querySelector('[title="Colored Epic"]') as HTMLElement;
    expect(tag).not.toBeNull();
    expect(tag).toHaveStyle({ color: '#A3BE8C' });
  });

  it('should render the branch chip when branch is set', () => {
    renderPanel({ ...taskFixture, branch: 'rat-75-ui' });
    expect(screen.getByText('rat-75-ui')).toBeInTheDocument();
  });

  it('should render a PR button with number and branch for each pullRequest', () => {
    renderPanel({
      ...taskFixture,
      branch: 'my-branch',
      pullRequests: [
        { url: 'https://github.com/owner/repo/pull/12', number: 12, title: 'RAT-63: First PR', state: 'OPEN' },
        { url: 'https://github.com/owner/repo/pull/13', number: 13, title: 'RAT-64: Second PR', state: 'MERGED' },
      ],
    });
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByText('#13')).toBeInTheDocument();
    expect(screen.getAllByText('my-branch')).toHaveLength(2);
  });

  it('should render raw prs as parsed number + branch when pullRequests is absent', () => {
    renderPanel({ ...taskFixture, branch: 'my-branch', prs: ['owner/repo/pull/42'] });
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('my-branch')).toBeInTheDocument();
  });

  it('should call openExternal when a PR row is clicked', async () => {
    const user = userEvent.setup();
    const prUrl = 'https://github.com/owner/repo/pull/12';
    renderPanel({
      ...taskFixture,
      pullRequests: [
        { url: prUrl, number: 12, title: 'RAT-63: Test PR', state: 'OPEN' },
      ],
    });
    await user.click(screen.getByRole('button', { name: /Open PR #12/i }));
    expect(mockOpenExternal).toHaveBeenCalledOnce();
    expect(mockOpenExternal).toHaveBeenCalledWith(prUrl);
  });

  it('should render the WONT_DO callout with reason when state is WONT_DO', () => {
    renderPanel({ ...taskFixture, state: 'WONT_DO', wontDoReason: 'Out of scope for v1.' });
    expect(screen.getByText("Won't do")).toBeDefined();
    expect(screen.getByText('Out of scope for v1.')).toBeDefined();
  });

  it('should not render the WONT_DO callout when state is not WONT_DO', () => {
    renderPanel({ ...taskFixture, state: 'IN_PROGRESS' });
    expect(screen.queryByText("Won't do")).toBeNull();
  });

  it('should render the comment form on the regular detail path', () => {
    renderPanel();
    expect(screen.getByTestId('comment-form')).toBeInTheDocument();
  });

  it('should not render the comment form on the loading state', () => {
    mockUseTicketDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useTicketDetail>);
    const onClose = vi.fn();
    renderWithProviders(
      <TicketDetailPanel
        projectName="ratatoskr"
        number={5}
        displayId="RAT-5"
        onClose={onClose}
      />,
      { initialEntries: ['/projects/ratatoskr/tickets?inspect=RAT-5'] },
    );
    expect(screen.queryByTestId('comment-form')).not.toBeInTheDocument();
  });

  it('should not render the comment form on the plan view', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: /view plan/i }));
    await waitFor(() => screen.getByRole('button', { name: /back to ticket/i }));
    expect(screen.queryByTestId('comment-form')).not.toBeInTheDocument();
  });
});
