import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

import { openUrl } from '@tauri-apps/plugin-opener';
import { openExternal } from './openExternal';

const mockOpenUrl = vi.mocked(openUrl);

describe('openExternal', () => {
  afterEach(() => {
    mockOpenUrl.mockReset();
    delete (global as Record<string, unknown>).window;
  });

  describe('Tauri context', () => {
    beforeEach(() => {
      (global as Record<string, unknown>).window = { __TAURI_INTERNALS__: {} };
    });

    it('calls openUrl with the full URL', async () => {
      await openExternal('https://github.com/Alexius-Huang/muninn/pull/13');
      expect(mockOpenUrl).toHaveBeenCalledOnce();
      expect(mockOpenUrl).toHaveBeenCalledWith('https://github.com/Alexius-Huang/muninn/pull/13');
    });
  });

  describe('non-Tauri context', () => {
    let mockWindowOpen: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockWindowOpen = vi.fn();
      (global as Record<string, unknown>).window = { open: mockWindowOpen };
    });

    it('falls back to window.open', async () => {
      await openExternal('https://github.com/Alexius-Huang/muninn/pull/13');
      expect(mockOpenUrl).not.toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledOnce();
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://github.com/Alexius-Huang/muninn/pull/13',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });
});
