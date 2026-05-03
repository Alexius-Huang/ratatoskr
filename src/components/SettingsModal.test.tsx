// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigResponse } from '../lib/api';
import { GITHUB_TOKEN_SENTINEL } from '../lib/githubToken';
import { SettingsModal } from './SettingsModal';

function mockFetch(opts: {
  config?: AppConfigResponse;
  tokenConfigured?: boolean;
  tokenPutStatus?: number;
  tokenDeleteStatus?: number;
}) {
  const config: AppConfigResponse = opts.config ?? {
    configured: true,
    workspaceRoot: '/ws',
    source: 'file',
    user: null,
  };
  const tokenConfigured = opts.tokenConfigured ?? false;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = (init as RequestInit | undefined)?.method?.toUpperCase() ?? 'GET';

    if (url.includes('/api/github-token') && method === 'PUT') {
      const status = opts.tokenPutStatus ?? 200;
      return new Response(
        status >= 400
          ? JSON.stringify({ error: 'write failed' })
          : JSON.stringify({ configured: true }),
        { status, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/api/github-token') && method === 'DELETE') {
      const status = opts.tokenDeleteStatus ?? 200;
      return new Response(JSON.stringify({ configured: false }), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/api/github-token')) {
      return new Response(JSON.stringify({ configured: tokenConfigured }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(config), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={qc}>
        <SettingsModal onClose={onClose} />
      </QueryClientProvider>,
    ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsModal', () => {
  it('should pre-fill input with workspaceRoot when source is file', async () => {
    mockFetch({ config: { configured: true, workspaceRoot: '/my/workspace', source: 'file', user: null } });
    renderModal();
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i) as HTMLInputElement;
      expect(input.value).toBe('/my/workspace');
    });
  });

  it('should show disabled input and env-var notice when source is env', async () => {
    mockFetch({ config: { configured: true, workspaceRoot: '/env/workspace', source: 'env', user: null } });
    renderModal();
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i) as HTMLInputElement;
      expect(input.disabled).toBe(true);
      expect(screen.getByText(/RATATOSKR_WORKSPACE_ROOT/)).toBeDefined();
    });
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
  });

  it('should call PUT /api/config and close on submit', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/github-token')) {
        return new Response(JSON.stringify({ configured: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      callCount++;
      const body = callCount === 1
        ? { configured: true, workspaceRoot: '/old', source: 'file', user: null }
        : { configured: true, workspaceRoot: '/new/path', source: 'file', user: null };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const { onClose } = renderModal();
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i) as HTMLInputElement;
      expect(input.value).toBe('/old');
    });
    const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i);
    await userEvent.clear(input);
    await userEvent.type(input, '/new/path');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      const putCall = fetchSpy.mock.calls.find(([u, init]) => String(u).includes('/api/config') && (init as RequestInit)?.method === 'PUT');
      expect(putCall).toBeDefined();
      expect(JSON.parse((putCall?.[1] as RequestInit)?.body as string)).toEqual({ workspaceRoot: '/new/path' });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('should close without API call when Cancel is clicked', async () => {
    mockFetch({});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { onClose } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    const putCalls = fetchSpy.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
  });
});

describe('SettingsModal — GitHub Token field', () => {
  it('should render a GitHub Token password input', async () => {
    mockFetch({ tokenConfigured: false });
    renderModal();
    await waitFor(() => {
      expect(screen.getByText(/github token/i)).toBeDefined();
    });
    const tokenInput = screen.getByPlaceholderText(/ghp_/i) as HTMLInputElement;
    expect(tokenInput.type).toBe('password');
  });

  it('should pre-fill token field with sentinel when a token is configured', async () => {
    mockFetch({ tokenConfigured: true });
    renderModal();
    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText(/ghp_/i) as HTMLInputElement;
      expect(tokenInput.value).toBe(GITHUB_TOKEN_SENTINEL);
    });
  });

  it('should leave token field empty when no token is configured', async () => {
    mockFetch({ tokenConfigured: false });
    renderModal();
    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText(/ghp_/i) as HTMLInputElement;
      expect(tokenInput.value).toBe('');
    });
  });

  it.each([
    ['new token typed', 'ghp_newtoken', 'PUT', { token: 'ghp_newtoken' }],
    ['field cleared', '', 'DELETE', null],
  ] as [string, string, string, { token: string } | null][])(
    'should issue %s on save',
    async (_label, inputValue, expectedMethod, expectedBody) => {
      const fetchSpy = mockFetch({ tokenConfigured: false });
      void fetchSpy;
      const { onClose } = renderModal();
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i) as HTMLInputElement;
        expect(input.value).toBe('/ws');
      });

      const tokenInput = screen.getByPlaceholderText(/ghp_/i);
      await userEvent.clear(tokenInput);
      if (inputValue) await userEvent.type(tokenInput, inputValue);

      await userEvent.click(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());

      const calls = vi.mocked(globalThis.fetch).mock.calls;
      const match = calls.find(([u, init]) => {
        return String(u).includes('/api/github-token') && (init as RequestInit)?.method?.toUpperCase() === expectedMethod;
      });
      expect(match).toBeDefined();
      if (expectedBody !== null) {
        expect(JSON.parse((match?.[1] as RequestInit)?.body as string)).toEqual(expectedBody);
      }
    },
  );

  it('should not call PUT or DELETE when token is unchanged (sentinel preserved)', async () => {
    mockFetch({ tokenConfigured: true });
    const { onClose } = renderModal();

    await waitFor(() => {
      const pathInput = screen.getByPlaceholderText(/\/users\/you\/workspace/i) as HTMLInputElement;
      expect(pathInput.value).toBe('/ws');
      const tokenInput = screen.getByPlaceholderText(/ghp_/i) as HTMLInputElement;
      expect(tokenInput.value).toBe(GITHUB_TOKEN_SENTINEL);
    });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const calls = vi.mocked(globalThis.fetch).mock.calls;
    const mutatingTokenCalls = calls.filter(([u, init]) => {
      const method = (init as RequestInit)?.method?.toUpperCase();
      return String(u).includes('/api/github-token') && (method === 'PUT' || method === 'DELETE');
    });
    expect(mutatingTokenCalls).toHaveLength(0);
  });

  it('should render an inline error when the PUT mutation fails', async () => {
    mockFetch({ tokenConfigured: false, tokenPutStatus: 500 });
    renderModal();

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i) as HTMLInputElement;
      expect(input.value).toBe('/ws');
    });

    const tokenInput = screen.getByPlaceholderText(/ghp_/i);
    await userEvent.type(tokenInput, 'ghp_bad');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/write failed|HTTP 500|error/i)).toBeDefined();
    });
  });
});
