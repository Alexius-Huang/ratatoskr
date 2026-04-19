// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TicketSummary } from '../../server/types';
import { renderWithProviders } from '../test/renderWithProviders';
import { EpicsTab } from './EpicsTab';

vi.mock('../lib/api', () => ({
  useTickets: vi.fn(),
}));

vi.mock('../lib/ticketMutations', () => ({
  useUpdateTicket: vi.fn(),
  useMarkEpicDone: vi.fn(),
}));

vi.mock('../lib/confetti', () => ({
  fireEpicDoneConfetti: vi.fn(),
}));

vi.mock('./EpicColorSwatchButton', () => ({
  EpicColorSwatchButton: () => null,
}));

vi.mock('./TicketDetailPanel', () => ({
  TicketDetailPanel: () => null,
}));

vi.mock('./SplitPane', () => ({
  SplitPane: ({ left }: { left: React.ReactNode }) => <div>{left}</div>,
}));

import { useTickets } from '../lib/api';
import { fireEpicDoneConfetti } from '../lib/confetti';
import { useMarkEpicDone, useUpdateTicket } from '../lib/ticketMutations';

const mockUseTickets = vi.mocked(useTickets);
const mockUseUpdateTicket = vi.mocked(useUpdateTicket);
const mockUseMarkEpicDone = vi.mocked(useMarkEpicDone);
const mockFireConfetti = vi.mocked(fireEpicDoneConfetti);

const allDoneChildCounts = {
  total: 1,
  byState: { NOT_READY: 0, PLANNING: 0, READY: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 1 },
};

function makeEpic(overrides: Partial<TicketSummary> = {}): TicketSummary {
  return {
    number: 1,
    displayId: 'RAT-1',
    type: 'Epic',
    title: 'Active Epic',
    state: 'IN_PROGRESS',
    created: '',
    updated: '',
    childCounts: allDoneChildCounts,
    ...overrides,
  };
}

const markDoneMutateFn = vi.fn();

function setupMocks(epics: TicketSummary[]) {
  mockUseTickets.mockReturnValue({ data: epics, isLoading: false, error: null } as ReturnType<typeof useTickets>);
  mockUseUpdateTicket.mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useUpdateTicket>);
  mockUseMarkEpicDone.mockReturnValue({ mutate: markDoneMutateFn } as unknown as ReturnType<typeof useMarkEpicDone>);
}

function render(epics: TicketSummary[]) {
  setupMocks(epics);
  return renderWithProviders(<EpicsTab />, {
    initialEntries: ['/projects/ratatoskr/epics'],
    routePath: '/projects/:name/*',
  });
}

describe('EpicsTab — Completed section', () => {
  beforeEach(() => {
    markDoneMutateFn.mockReset();
    mockFireConfetti.mockReset();
  });

  it('should render all active epics above a Completed section when DONE epics exist', () => {
    render([
      makeEpic({ number: 1, displayId: 'RAT-1', title: 'Active Epic', state: 'IN_PROGRESS' }),
      makeEpic({ number: 2, displayId: 'RAT-2', title: 'Done Epic', state: 'DONE' }),
    ]);
    expect(screen.getByText('Active Epic')).toBeInTheDocument();
    expect(screen.getByText('Done Epic')).toBeInTheDocument();
    expect(screen.getByText(/^Completed \(1\)$/)).toBeInTheDocument();
  });

  it('should omit the Completed section when no epics are DONE', () => {
    render([makeEpic({ state: 'IN_PROGRESS' })]);
    expect(screen.queryByText(/^Completed/)).not.toBeInTheDocument();
  });

  it('should call useMarkEpicDone.mutate with the epic number when Mark-Done button is clicked', async () => {
    const user = userEvent.setup();
    render([makeEpic({ state: 'IN_PROGRESS', childCounts: allDoneChildCounts })]);
    const btns = screen.getAllByRole('button', { name: /mark epic as done/i });
    const markDoneBtn = btns.find((el) => el.tagName === 'BUTTON')!;
    await user.click(markDoneBtn);
    expect(markDoneMutateFn).toHaveBeenCalledWith(1, expect.any(Object));
  });
});
