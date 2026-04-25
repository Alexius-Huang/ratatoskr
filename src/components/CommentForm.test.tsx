// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, afterEach } from 'vitest';
import type { Comment } from '../../server/types';
import { CommentForm } from './CommentForm';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    useAppConfig: () => ({
      data: { user: { username: 'j.huang', display_name: 'J Huang' }, configured: true, workspaceRoot: '/tmp', source: null },
    }),
  };
});

function stubFetch(data: unknown, status = 201) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    }),
  );
}

function stubFetchError(message: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: message }),
    }),
  );
}

function renderForm() {
  return renderWithProviders(
    <CommentForm projectName="ratatoskr" ticketNumber={5} />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CommentForm', () => {
  it('should render a textarea and a hint label', () => {
    renderForm();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText(/Press ↵ to post/)).toBeInTheDocument();
  });

  it('should not submit when Enter is pressed and the textarea is empty', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderForm();
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Enter}');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([' ', '   ', '\t'])(
    'should not submit when Enter is pressed and the textarea contains only whitespace %j',
    async (whitespace) => {
      const user = userEvent.setup();
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      renderForm();
      await user.type(screen.getByRole('textbox'), whitespace);
      await user.keyboard('{Enter}');
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('should submit when Enter is pressed and the textarea has content', async () => {
    const user = userEvent.setup();
    const newComment: Comment = {
      n: 1,
      author: 'j.huang',
      displayName: 'J Huang',
      timestamp: new Date().toISOString(),
      body: 'hello',
    };
    stubFetch(newComment);
    renderForm();
    await user.type(screen.getByRole('textbox'), 'hello');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/projects/ratatoskr/tickets/5/comments');
      expect((init as RequestInit).method).toBe('POST');
      const parsed = JSON.parse((init as RequestInit).body as string);
      expect(parsed.body).toBe('hello');
      expect(parsed.author).toEqual({ username: 'j.huang', display_name: 'J Huang' });
    });
  });

  it('should not submit when Shift+Enter is pressed', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderForm();
    await user.type(screen.getByRole('textbox'), 'hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should clear the textarea immediately after Enter is pressed before the fetch resolves', async () => {
    const user = userEvent.setup();
    let resolveFetch!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );
    renderForm();
    await user.type(screen.getByRole('textbox'), 'immediate clear');
    await user.keyboard('{Enter}');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    resolveFetch({ ok: true, status: 201, json: () => Promise.resolve({}) });
  });

  it('should restore the typed text and show an inline error when the POST fails', async () => {
    const user = userEvent.setup();
    stubFetchError('Network error');
    renderForm();
    await user.type(screen.getByRole('textbox'), 'my comment');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('my comment');
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('should clear the inline error when the user starts typing again after a failure', async () => {
    const user = userEvent.setup();
    stubFetchError('boom');
    renderForm();
    await user.type(screen.getByRole('textbox'), 'first');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());

    await user.type(screen.getByRole('textbox'), 'second attempt');
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });

  it('should optimistically append the new comment body before the fetch resolves', async () => {
    const user = userEvent.setup();
    let resolveFetch!: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise));

    renderWithProviders(<CommentForm projectName="ratatoskr" ticketNumber={5} />);

    await user.type(screen.getByRole('textbox'), 'optimistic body');
    await user.keyboard('{Enter}');

    // textarea cleared = submit ran; cache updated optimistically
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    resolveFetch({ ok: true, status: 201, json: () => Promise.resolve({}) });
  });
});
