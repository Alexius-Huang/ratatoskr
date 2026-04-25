// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigResponse } from '../lib/api';
import { SettingsModal } from './SettingsModal';

function mockConfig(config: AppConfigResponse) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(config), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    mockConfig({ configured: true, workspaceRoot: '/my/workspace', source: 'file', user: null });
    renderModal();
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i) as HTMLInputElement;
      expect(input.value).toBe('/my/workspace');
    });
  });

  it('should show disabled input and env-var notice when source is env', async () => {
    mockConfig({ configured: true, workspaceRoot: '/env/workspace', source: 'env', user: null });
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
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
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
    mockConfig({ configured: true, workspaceRoot: '/ws', source: 'file', user: null });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { onClose } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    const putCalls = fetchSpy.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
  });
});
