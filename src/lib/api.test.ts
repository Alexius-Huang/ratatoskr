import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, apiFetch } from './api';

afterEach(() => vi.unstubAllGlobals());

function mockFetch({
  ok = true,
  status = 200,
  jsonValue,
  jsonThrows = false,
}: {
  ok?: boolean;
  status?: number;
  jsonValue?: unknown;
  jsonThrows?: boolean;
}) {
  const res = {
    ok,
    status,
    json: jsonThrows
      ? vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
      : vi.fn().mockResolvedValue(jsonValue),
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
}

describe('api', () => {
  describe('apiFetch', () => {
    it('should return parsed JSON on a 2xx response', async () => {
      mockFetch({ jsonValue: { id: 1, name: 'ratatoskr' } });
      const result = await apiFetch<{ id: number; name: string }>('/api/projects');
      expect(result).toEqual({ id: 1, name: 'ratatoskr' });
    });

    it('should throw ApiError with the server error message on a non-2xx response', async () => {
      mockFetch({ ok: false, status: 400, jsonValue: { error: 'ticket not found' } });
      await expect(apiFetch('/api/projects/ratatoskr/tickets/99')).rejects.toMatchObject({
        message: 'ticket not found',
        status: 400,
      });
      await expect(apiFetch('/api/projects/ratatoskr/tickets/99')).rejects.toBeInstanceOf(ApiError);
    });

    it('should throw ApiError with "HTTP <status>" fallback when the response body is not JSON', async () => {
      mockFetch({ ok: false, status: 500, jsonThrows: true });
      await expect(apiFetch('/api/projects/ratatoskr/tickets/99')).rejects.toMatchObject({
        message: 'HTTP 500',
        status: 500,
      });
    });
  });

  describe('ApiError', () => {
    it('should carry the correct status property', () => {
      const err = new ApiError('not found', 404);
      expect(err.status).toBe(404);
      expect(err.message).toBe('not found');
      expect(err).toBeInstanceOf(ApiError);
    });
  });
});
