// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SetupScreen } from './SetupScreen';

function renderSetup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SetupScreen />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SetupScreen', () => {
  it('should render heading, input, and submit button', () => {
    renderSetup();
    expect(screen.getByText(/welcome to ratatoskr/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/\/users\/you\/workspace/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /save/i })).toBeDefined();
  });

  it('should disable Save button when input is empty', () => {
    renderSetup();
    const btn = screen.getByRole('button', { name: /save/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should enable Save button when input has text', async () => {
    renderSetup();
    const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i);
    await userEvent.type(input, '/my/path');
    const btn = screen.getByRole('button', { name: /save/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('should call PUT /api/config with the entered path on submit', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ configured: true, workspaceRoot: '/my/path', source: 'file' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderSetup();
    const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i);
    await userEvent.type(input, '/my/path');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/api/config'));
      expect(call).toBeDefined();
      expect(call?.[1]?.method).toBe('PUT');
      expect(JSON.parse(call?.[1]?.body as string)).toEqual({ workspaceRoot: '/my/path' });
    });
  });

  it('should show error message when mutation rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Path is not an existing directory' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderSetup();
    const input = screen.getByPlaceholderText(/\/users\/you\/workspace/i);
    await userEvent.type(input, '/bad/path');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/path is not an existing directory/i)).toBeDefined();
    });
  });
});
