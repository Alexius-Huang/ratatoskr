// @vitest-environment jsdom
// Integration test: renders CommentSection + real CommentItem (not mocked) to verify
// that the query cache update from useEditComment propagates to the rendered output.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Comment } from '../../server/types';
import { CommentSection } from './CommentSection';
import { makeComment } from '../test/factories';

vi.mock('./MarkdownBody', () => ({
  MarkdownBody: ({ source }: { source: string }) => <div data-testid="markdown-body">{source}</div>,
}));

const mockUseAppConfig = vi.fn();
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, useAppConfig: () => mockUseAppConfig() };
});

function makeQueryClient(comments: Comment[]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  qc.setQueryData(['comments', 'ratatoskr', 5], comments);
  return qc;
}

function renderSection(qc: QueryClient) {
  return render(
    <MemoryRouter initialEntries={['/projects/ratatoskr/tickets']}>
      <Routes>
        <Route
          path="/projects/:name/*"
          element={
            <QueryClientProvider client={qc}>
              <CommentSection projectName="ratatoskr" ticketNumber={5} />
            </QueryClientProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  mockUseAppConfig.mockReset();
});

describe('CommentItem edit (integration with CommentSection)', () => {
  it('should render the updated body in the list after a successful save', async () => {
    const user = userEvent.setup();
    mockUseAppConfig.mockReturnValue({
      data: { user: { username: 'alice', display_name: 'Alice' }, configured: true },
    });

    const comment = makeComment({ n: 1, author: 'alice', body: 'Original' });
    const updatedComment: Comment = {
      ...comment,
      body: 'Edited body',
      updated: '2026-04-26T10:00:00.000Z',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve(
              (init as RequestInit)?.method === 'PATCH' ? updatedComment : [updatedComment],
            ),
        }),
      ),
    );

    const qc = makeQueryClient([comment]);
    renderSection(qc);

    expect(screen.getByTestId('markdown-body')).toHaveTextContent('Original');
    expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Edited body');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByTestId('markdown-body')).toHaveTextContent('Edited body');
    });
    expect(screen.getByTitle('2026-04-26T10:00:00.000Z')).toBeInTheDocument();
  });
});
