// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MainPane } from './MainPane';

vi.mock('../lib/api', () => ({
  useProjects: vi.fn(),
}));

vi.mock('./TicketsTab', () => ({
  TicketsTab: () => <div data-testid="tab-tickets" />,
}));

vi.mock('./EpicsTab', () => ({
  EpicsTab: () => <div data-testid="tab-epics" />,
}));

vi.mock('./BoardTab', () => ({
  BoardTab: () => <div data-testid="tab-board" />,
}));

vi.mock('./ArchiveTab', () => ({
  ArchiveTab: () => <div data-testid="tab-archive" />,
}));

import { useProjects } from '../lib/api';

const mockUseProjects = vi.mocked(useProjects);

const projectFixture = {
  name: 'ratatoskr',
  config: { prefix: 'RAT', defaultAssignee: null },
  hasConfig: true,
  warnings: [],
};

function setupMocks() {
  mockUseProjects.mockReturnValue({
    data: [projectFixture],
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useProjects>);
}

describe('MainPane', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('should render the NotFound screen when the URL project is not in the projects list', () => {
    renderWithProviders(<MainPane />, {
      initialEntries: ['/projects/ghost/tickets'],
      routePath: '/projects/:name/:tab',
    });
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(screen.getByText(/project 'ghost' is not registered/i)).toBeInTheDocument();
  });

  it('should render the tab content when the URL project exists', () => {
    renderWithProviders(<MainPane />, {
      initialEntries: ['/projects/ratatoskr/tickets'],
      routePath: '/projects/:name/:tab',
    });
    expect(screen.getByTestId('tab-tickets')).toBeInTheDocument();
  });

  it('should redirect to tickets when the tab is unknown', () => {
    renderWithProviders(<MainPane />, {
      initialEntries: ['/projects/ratatoskr/bogus'],
      routePath: '/projects/:name/:tab',
    });
    expect(screen.getByTestId('tab-tickets')).toBeInTheDocument();
  });
});
