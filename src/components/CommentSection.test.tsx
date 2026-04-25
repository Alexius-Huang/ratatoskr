// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import type { Comment } from '../../server/types';
import { CommentSection } from './CommentSection';
import { renderWithProviders } from '../test/renderWithProviders';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    n: 1,
    author: 'claude',
    displayName: 'Claude',
    timestamp: new Date().toISOString(),
    body: 'Hello world',
    ...overrides,
  };
}

function stubFetch(data: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    }),
  );
}

function stubFetchReject(message: string) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

function renderCommentSection(
  projectName: string | null = 'ratatoskr',
  ticketNumber: number | null = 48,
) {
  return renderWithProviders(
    <CommentSection
      projectName={projectName as string}
      ticketNumber={ticketNumber as number}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CommentSection', () => {
  it('should render the empty-state message when the API returns no comments', async () => {
    stubFetch([]);
    renderCommentSection();
    await waitFor(() => expect(screen.getByText('No comments yet.')).toBeInTheDocument());
  });

  it('should render display name, @username, relative timestamp, and markdown body for each comment', async () => {
    stubFetch([makeComment({ author: 'claude', displayName: 'Claude', body: '**bold**' })]);
    renderCommentSection();
    await waitFor(() => expect(screen.getByText('Claude')).toBeInTheDocument());
    expect(screen.getByText('@claude')).toBeInTheDocument();
    const strong = document.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('bold');
  });

  it('should render multiple comments in the order returned by the API', async () => {
    stubFetch([
      makeComment({ n: 1, displayName: 'Alice', author: 'alice', body: 'First' }),
      makeComment({ n: 2, displayName: 'Bob', author: 'bob', body: 'Second' }),
    ]);
    renderCommentSection();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    const names = screen.getAllByText(/^(Alice|Bob)$/);
    expect(names[0].textContent).toBe('Alice');
    expect(names[1].textContent).toBe('Bob');
  });

  it('should render an inline error when the fetch fails', async () => {
    stubFetchReject('Network error');
    renderCommentSection();
    await waitFor(() =>
      expect(screen.getByText(/Failed to load comments/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it('should not call fetch when projectName is null', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderCommentSection(null, 48);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should not call fetch when ticketNumber is null', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderCommentSection('ratatoskr', null);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
