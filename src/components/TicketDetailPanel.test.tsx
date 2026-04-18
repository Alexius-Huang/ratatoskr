// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TicketDetail } from '../../server/types';
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

vi.mock('./MarkdownBody', () => ({
  MarkdownBody: ({ source }: { source: string }) => (
    <div data-testid="markdown-body">{source}</div>
  ),
}));

import { useTicketDetail, useTicketPlan } from '../lib/api';
import { useArchiveTicket } from '../lib/ticketMutations';

const mockUseTicketDetail = vi.mocked(useTicketDetail);
const mockUseTicketPlan = vi.mocked(useTicketPlan);
const mockUseArchiveTicket = vi.mocked(useArchiveTicket);

const taskFixture: TicketDetail = {
  number: 5,
  displayId: 'RAT-5',
  type: 'Task',
  title: 'My task title',
  state: 'IN_PROGRESS',
  body: 'Task body text',
  planDoc: 'plans/5.md',
  created: '',
  updated: '',
};

const epicFixture: TicketDetail = {
  number: 10,
  displayId: 'RAT-10',
  type: 'Epic',
  title: 'My epic title',
  state: 'IN_PROGRESS',
  body: 'Epic body text',
  created: '',
  updated: '',
  childCounts: {
    total: 3,
    byState: {
      NOT_READY: 0,
      PLANNING: 0,
      READY: 1,
      IN_PROGRESS: 1,
      IN_REVIEW: 0,
      DONE: 1,
    },
  },
};

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
});
