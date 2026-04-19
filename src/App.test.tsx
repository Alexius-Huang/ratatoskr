// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import App from './App';

vi.mock('./components/Sidebar', () => ({
  Sidebar: () => null,
}));

vi.mock('./components/MainPane', () => ({
  MainPane: () => <div data-testid="main-pane" />,
}));

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ configured: true, workspaceRoot: '/ws', source: 'env' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderApp(initialEntries: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('should render NotFound for an unknown route', async () => {
    renderApp(['/completely/wrong']);
    await waitFor(() => expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument());
  });

  it('should render the EmptyState at the workspace root', async () => {
    renderApp(['/']);
    await waitFor(() => expect(screen.getByText('Select a project')).toBeInTheDocument());
  });

  it('should render the main pane for a valid project route', async () => {
    renderApp(['/projects/ratatoskr/tickets']);
    await waitFor(() => expect(screen.getByTestId('main-pane')).toBeInTheDocument());
  });
});
