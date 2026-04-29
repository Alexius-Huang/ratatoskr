// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectStatusCard } from './ProjectStatusCard';
import { makeTicketSummary } from '../test/factories';

vi.mock('../lib/api', () => ({
  useTickets: vi.fn(),
  useArchive: vi.fn(),
}));

import { useTickets, useArchive } from '../lib/api';

const mockUseTickets = vi.mocked(useTickets);
const mockUseArchive = vi.mocked(useArchive);

const project = { name: 'ratatoskr', config: { prefix: 'RAT' }, hasConfig: true, warnings: [] };

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route
          path="*"
          element={
            <QueryClientProvider client={qc}>
              <ProjectStatusCard project={project} />
            </QueryClientProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectStatusCard', () => {
  beforeEach(() => {
    mockUseTickets.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTickets>);
    mockUseArchive.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useArchive>);
  });

  it('should render the project name and total ticket count (excluding WONT_DO)', () => {
    const tickets = [
      makeTicketSummary({ state: 'DONE' }),
      makeTicketSummary({ state: 'IN_PROGRESS' }),
      makeTicketSummary({ state: 'WONT_DO' }),
    ];
    mockUseTickets.mockReturnValue({
      data: tickets,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTickets>);

    renderCard();
    expect(screen.getByText('ratatoskr')).toBeInTheDocument();
    expect(screen.getByText('2 tickets')).toBeInTheDocument();
  });

  it('should render the bug indicator when openBugs > 0', () => {
    mockUseTickets.mockReturnValue({
      data: [makeTicketSummary({ type: 'Bug', state: 'IN_PROGRESS' })],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTickets>);

    renderCard();
    expect(screen.getByLabelText('1 open bugs')).toBeInTheDocument();
  });

  it('should hide the bug indicator when openBugs === 0', () => {
    mockUseTickets.mockReturnValue({
      data: [makeTicketSummary({ type: 'Bug', state: 'DONE' })],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTickets>);

    renderCard();
    expect(screen.queryByLabelText(/open bugs/)).not.toBeInTheDocument();
  });

  it('should render bar segments with widths proportional to bucket counts', () => {
    const tickets = [
      makeTicketSummary({ state: 'DONE' }),
      makeTicketSummary({ state: 'DONE' }),
      makeTicketSummary({ state: 'IN_PROGRESS' }),
      makeTicketSummary({ state: 'NOT_READY' }),
    ];
    mockUseTickets.mockReturnValue({
      data: tickets,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTickets>);

    const { container } = renderCard();
    const bar = container.querySelector('[role="progressbar"]') as HTMLElement;
    const segments = bar.querySelectorAll('div');
    expect(segments).toHaveLength(3);
    expect((segments[0] as HTMLElement).style.width).toBe('50%');
    expect((segments[1] as HTMLElement).style.width).toBe('25%');
    expect((segments[2] as HTMLElement).style.width).toBe('25%');
  });

  it('should collapse zero-count segments to no DOM element', () => {
    mockUseTickets.mockReturnValue({
      data: [
        makeTicketSummary({ state: 'DONE' }),
        makeTicketSummary({ state: 'DONE' }),
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTickets>);

    const { container } = renderCard();
    const bar = container.querySelector('[role="progressbar"]') as HTMLElement;
    const segments = bar.querySelectorAll('div');
    expect(segments).toHaveLength(1);
    expect((segments[0] as HTMLElement).style.width).toBe('100%');
  });

  it('should render a link to /projects/<name>', () => {
    renderCard();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/projects/ratatoskr');
  });

  it('should include archived tickets in the total count and bar', () => {
    mockUseTickets.mockReturnValue({
      data: [makeTicketSummary({ state: 'IN_PROGRESS' })],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTickets>);
    mockUseArchive.mockReturnValue({
      data: [
        { ...makeTicketSummary({ state: 'DONE' }), archived: '2026-01-02T00:00:00.000Z', body: '' },
        { ...makeTicketSummary({ state: 'DONE' }), archived: '2026-01-02T00:00:00.000Z', body: '' },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useArchive>);

    renderCard();
    expect(screen.getByText('3 tickets')).toBeInTheDocument();
    expect(screen.getByText('2 done · 1 in progress · 0 todo')).toBeInTheDocument();
  });

  it('should show "Loading…" in the summary line while tickets are loading', () => {
    mockUseTickets.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useTickets>);

    renderCard();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('should show "Loading…" in the summary line while archive is loading', () => {
    mockUseArchive.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useArchive>);

    renderCard();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
