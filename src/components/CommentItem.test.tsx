// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import type { Comment } from '../../server/types';
import { CommentItem } from './CommentItem';
import { renderWithProviders } from '../test/renderWithProviders';
import { makeComment } from '../test/factories';

const mockUseAppConfig = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    useAppConfig: () => mockUseAppConfig(),
  };
});

vi.mock('./MarkdownBody', () => ({
  MarkdownBody: ({ source }: { source: string }) => <div data-testid="markdown-body">{source}</div>,
}));

function stubConfig(username: string | null) {
  mockUseAppConfig.mockReturnValue({
    data: username
      ? { user: { username, display_name: 'Test User' }, configured: true }
      : { user: null, configured: false },
  });
}

function stubFetch(response: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    }),
  );
}

function renderItem(comment: Comment) {
  return renderWithProviders(
    <CommentItem projectName="ratatoskr" ticketNumber={5} comment={comment} />,
  );
}

function renderItemWithState(initialComment: Comment) {
  let setComment!: (c: Comment) => void;
  function Wrapper() {
    const [c, setC] = useState(initialComment);
    setComment = setC;
    return <CommentItem projectName="ratatoskr" ticketNumber={5} comment={c} />;
  }
  renderWithProviders(<Wrapper />);
  return { setComment: (c: Comment) => act(() => setComment(c)) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  mockUseAppConfig.mockReset();
});

describe('CommentItem', () => {
  it('should render the comment body and timestamp', () => {
    stubConfig(null);
    const comment = makeComment({ author: 'alice', body: 'Hello world', timestamp: '2026-01-01T00:00:00.000Z' });
    renderItem(comment);
    expect(screen.getByTestId('markdown-body')).toHaveTextContent('Hello world');
    expect(screen.getByTitle('2026-01-01T00:00:00.000Z')).toBeInTheDocument();
  });

  it('should show an Edit button when the comment author matches the current user', () => {
    stubConfig('alice');
    const comment = makeComment({ author: 'alice' });
    renderItem(comment);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('should not show an Edit button when authored by someone else', () => {
    stubConfig('bob');
    const comment = makeComment({ author: 'alice' });
    renderItem(comment);
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('should not show an Edit button when no user is configured', () => {
    stubConfig(null);
    const comment = makeComment({ author: 'alice' });
    renderItem(comment);
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('should replace the body with a pre-filled textarea when Edit is clicked', async () => {
    const user = userEvent.setup();
    stubConfig('alice');
    const comment = makeComment({ author: 'alice', body: 'My original comment' });
    renderItem(comment);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('My original comment');
  });

  it('should call the PATCH endpoint when Save is clicked', async () => {
    const user = userEvent.setup();
    const comment = makeComment({ n: 3, author: 'alice', body: 'Original' });
    stubConfig('alice');
    const updatedComment: Comment = { ...comment, body: 'Edited', updated: new Date().toISOString() };
    stubFetch(updatedComment);

    renderItem(comment);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Edited');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      const patchCall = fetchMock.mock.calls.find(
        ([url, init]) => (init as RequestInit)?.method === 'PATCH' && String(url).includes('/comments/3'),
      );
      expect(patchCall).toBeDefined();
      const [, patchInit] = patchCall!;
      const body = JSON.parse((patchInit as RequestInit).body as string);
      expect(body.body).toBe('Edited');
    });
  });

  it('should restore the original body and not call PATCH when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    stubConfig('alice');
    const comment = makeComment({ author: 'alice', body: 'Original text' });

    renderItem(comment);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Changed text');
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByTestId('markdown-body')).toHaveTextContent('Original text');
    const patchCalls = fetchSpy.mock.calls.filter(
      (args: unknown[]) => (args[1] as RequestInit)?.method === 'PATCH',
    );
    expect(patchCalls).toHaveLength(0);
  });

  it('should disable Save when the draft is empty', async () => {
    const user = userEvent.setup();
    stubConfig('alice');
    const comment = makeComment({ author: 'alice', body: 'Original' });
    renderItem(comment);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('should disable Save when the draft is unchanged from the original body', async () => {
    const user = userEvent.setup();
    stubConfig('alice');
    const comment = makeComment({ author: 'alice', body: 'Original' });
    renderItem(comment);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('should display an "(edited)" marker when the comment has an updated timestamp', () => {
    stubConfig(null);
    const comment = makeComment({
      author: 'alice',
      timestamp: '2026-01-01T00:00:00.000Z',
      updated: '2026-04-26T10:00:00.000Z',
    });
    renderItem(comment);
    expect(screen.getByTitle('2026-04-26T10:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it('should pre-fill the textarea with the current body when comment body changes before editing', async () => {
    const user = userEvent.setup();
    stubConfig('alice');
    const comment = makeComment({ author: 'alice', body: 'Original' });
    const { setComment } = renderItemWithState(comment);

    setComment({ ...comment, body: 'Externally updated' });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Externally updated');
  });

  it('should disable Cancel while a save is in flight', async () => {
    const user = userEvent.setup();
    stubConfig('alice');
    const comment = makeComment({ author: 'alice', body: 'Original' });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    renderItem(comment);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Changed');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });
});
