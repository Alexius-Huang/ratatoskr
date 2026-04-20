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
  byState: { NOT_READY: 0, PLANNING: 0, READY: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 1, WONT_DO: 0 },
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

describe('EpicsTab — filter bar', () => {
  beforeEach(() => {
    markDoneMutateFn.mockReset();
    mockFireConfetti.mockReset();
  });

  it('renders the filter input above the list', () => {
    render([makeEpic()]);
    expect(screen.getByRole('textbox', { name: /filter epics/i })).toBeInTheDocument();
  });

  it('filters by title substring (case-insensitive)', async () => {
    const user = userEvent.setup();
    render([
      makeEpic({ number: 1, displayId: 'RAT-1', title: 'Alpha Feature' }),
      makeEpic({ number: 2, displayId: 'RAT-2', title: 'Beta Feature' }),
      makeEpic({ number: 3, displayId: 'RAT-3', title: 'Alpha Bugfix' }),
    ]);
    await user.type(screen.getByRole('textbox', { name: /filter epics/i }), 'alpha');
    expect(screen.getByText('Alpha Feature')).toBeInTheDocument();
    expect(screen.getByText('Alpha Bugfix')).toBeInTheDocument();
    expect(screen.queryByText('Beta Feature')).not.toBeInTheDocument();
  });

  it('filters by displayId substring (case-insensitive, substring — RAT-1 matches RAT-1 and RAT-10)', async () => {
    const user = userEvent.setup();
    render([
      makeEpic({ number: 1, displayId: 'RAT-1', title: 'First' }),
      makeEpic({ number: 2, displayId: 'RAT-2', title: 'Second' }),
      makeEpic({ number: 10, displayId: 'RAT-10', title: 'Tenth' }),
    ]);
    await user.type(screen.getByRole('textbox', { name: /filter epics/i }), 'rat-1');
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Tenth')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });

  it('filter applies to the Completed section too', async () => {
    const user = userEvent.setup();
    render([
      makeEpic({ number: 1, displayId: 'RAT-1', title: 'Active Epic', state: 'IN_PROGRESS' }),
      makeEpic({ number: 2, displayId: 'RAT-2', title: 'Done Epic', state: 'DONE' }),
    ]);
    await user.type(screen.getByRole('textbox', { name: /filter epics/i }), 'Done Epic');
    expect(screen.getByText('Done Epic')).toBeInTheDocument();
    expect(screen.queryByText('Active Epic')).not.toBeInTheDocument();
  });

  it('shows "No matching epics" when nothing matches', async () => {
    const user = userEvent.setup();
    render([makeEpic({ title: 'Alpha Feature' })]);
    await user.type(screen.getByRole('textbox', { name: /filter epics/i }), 'zzz-no-match');
    expect(screen.getByText('No matching epics')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Feature')).not.toBeInTheDocument();
  });

  it('clearing the input restores the full list', async () => {
    const user = userEvent.setup();
    render([
      makeEpic({ number: 1, displayId: 'RAT-1', title: 'Alpha Feature' }),
      makeEpic({ number: 2, displayId: 'RAT-2', title: 'Beta Feature' }),
    ]);
    const input = screen.getByRole('textbox', { name: /filter epics/i });
    await user.type(input, 'alpha');
    expect(screen.queryByText('Beta Feature')).not.toBeInTheDocument();
    await user.clear(input);
    expect(screen.getByText('Alpha Feature')).toBeInTheDocument();
    expect(screen.getByText('Beta Feature')).toBeInTheDocument();
    expect(screen.queryByText('No matching epics')).not.toBeInTheDocument();
  });
});

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

describe('EpicsTab — scroll containers', () => {
  beforeEach(() => {
    markDoneMutateFn.mockReset();
    mockFireConfetti.mockReset();
  });

  it('renders the filter bar outside the rows scroll container', () => {
    render([makeEpic()]);
    const input = screen.getByRole('textbox', { name: /filter epics/i });
    // Walk up to find the nearest ancestor with overflow-y-auto (the rows container)
    // The filter input's immediate parent chain must NOT include overflow-y-auto before
    // the outer wrapper — i.e., the filter bar is in the non-scrolling header section.
    let el: HTMLElement | null = input.parentElement;
    while (el) {
      if (el.className.includes('overflow-y-auto')) {
        throw new Error('Filter input is inside a scroll container — it should be outside');
      }
      // Stop at the list root (h-full flex flex-col)
      if (el.className.includes('h-full') && el.className.includes('flex-col')) break;
      el = el.parentElement;
    }
    // The rows container (sibling of the header) must have overflow-y-auto
    const listRoot = input.closest('.flex-col');
    expect(listRoot).not.toBeNull();
    const scrollContainer = listRoot!.querySelector('.overflow-y-auto');
    expect(scrollContainer).not.toBeNull();
  });

  it('does not apply pb-72 to the rows scroll container', () => {
    render([makeEpic()]);
    const input = screen.getByRole('textbox', { name: /filter epics/i });
    const listRoot = input.closest('.flex-col');
    expect(listRoot).not.toBeNull();
    const scrollContainer = listRoot!.querySelector('.overflow-y-auto');
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer!.className).not.toContain('pb-72');
  });

  it('wraps the list in a height-constrained container when no epic is selected', () => {
    render([makeEpic()]);
    const input = screen.getByRole('textbox', { name: /filter epics/i });
    // The outer wrapper (added by the no-inspect return branch) must have h-full
    const outerWrapper = input.closest('.min-h-0');
    expect(outerWrapper).not.toBeNull();
  });
});
