// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomePane } from './HomePane';

vi.mock('../lib/api', () => ({
  useProjects: vi.fn(),
  useTickets: vi.fn(),
  useArchive: vi.fn(),
}));

import { useProjects, useTickets, useArchive } from '../lib/api';

const mockUseProjects = vi.mocked(useProjects);
const mockUseTickets = vi.mocked(useTickets);
const mockUseArchive = vi.mocked(useArchive);

const project1 = { name: 'alpha', config: { prefix: 'ALP' }, hasConfig: true, warnings: [] };
const project2 = { name: 'beta', config: { prefix: 'BET' }, hasConfig: true, warnings: [] };

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route
          path="*"
          element={<QueryClientProvider client={qc}><HomePane /></QueryClientProvider>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomePane', () => {
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

  it('should render one card per project in projects-list order', () => {
    mockUseProjects.mockReturnValue({
      data: [project1, project2],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useProjects>);

    renderHome();
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/projects/alpha');
    expect(links[1]).toHaveAttribute('href', '/projects/beta');
  });

  it('should show a loading message while projects are loading', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useProjects>);

    renderHome();
    expect(screen.getByText('Loading projects…')).toBeInTheDocument();
  });

  it('should show an error banner when the projects query errors', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as unknown as ReturnType<typeof useProjects>);

    renderHome();
    expect(screen.getByText(/Failed to load projects: Network error/)).toBeInTheDocument();
  });

  it('should show "No projects detected" when the list is empty', () => {
    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useProjects>);

    renderHome();
    expect(screen.getByText('No projects detected.')).toBeInTheDocument();
  });
});
