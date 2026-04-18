// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from './App';

vi.mock('./components/Sidebar', () => ({
  Sidebar: () => null,
}));

vi.mock('./components/MainPane', () => ({
  MainPane: () => <div data-testid="main-pane" />,
}));

function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('should render NotFound for an unknown route', () => {
    renderApp(['/completely/wrong']);
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
  });

  it('should render the EmptyState at the workspace root', () => {
    renderApp(['/']);
    expect(screen.getByText('Select a project')).toBeInTheDocument();
  });

  it('should render the main pane for a valid project route', () => {
    renderApp(['/projects/ratatoskr/tickets']);
    expect(screen.getByTestId('main-pane')).toBeInTheDocument();
  });
});
