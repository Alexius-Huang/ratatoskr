import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

type Options = {
  initialEntries?: string[];
  routePath?: string;
};

export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ['/projects/ratatoskr/tickets'], routePath = '/projects/:name/*' }: Options = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path={routePath}
          element={<QueryClientProvider client={qc}>{ui}</QueryClientProvider>}
        />
      </Routes>
    </MemoryRouter>,
  );
}
