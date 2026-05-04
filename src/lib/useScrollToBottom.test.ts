// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollToBottom } from './useScrollToBottom';

describe('useScrollToBottom', () => {
  let capturedRoCallback: ResizeObserverCallback;

  beforeEach(() => {
    capturedRoCallback = () => {};
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        capturedRoCallback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  function makeScrollDiv({
    scrollHeight = 500,
    clientHeight = 500,
    initialScrollTop = 0,
  }: { scrollHeight?: number; clientHeight?: number; initialScrollTop?: number } = {}) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    let scrollTop = initialScrollTop;
    Object.defineProperty(div, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(div, 'clientHeight', { configurable: true, get: () => clientHeight });
    Object.defineProperty(div, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
    });
    return { div, setScrollTop: (v: number) => { scrollTop = v; } };
  }

  it('should return true when content fits the viewport', () => {
    const { div } = makeScrollDiv({ scrollHeight: 400, clientHeight: 500 });
    const ref = { current: div };
    const { result } = renderHook(() => useScrollToBottom(ref, 1));
    expect(result.current).toBe(true);
  });

  it('should return false when content overflows and is not scrolled', () => {
    const { div } = makeScrollDiv({ scrollHeight: 1000, clientHeight: 500, initialScrollTop: 0 });
    const ref = { current: div };
    const { result } = renderHook(() => useScrollToBottom(ref, 1));
    expect(result.current).toBe(false);
  });

  it('should return true when already scrolled to the bottom on mount', () => {
    // 1000 - 500 - 499 = 1 <= 2
    const { div } = makeScrollDiv({ scrollHeight: 1000, clientHeight: 500, initialScrollTop: 499 });
    const ref = { current: div };
    const { result } = renderHook(() => useScrollToBottom(ref, 1));
    expect(result.current).toBe(true);
  });

  it('should flip to true when a scroll event fires at the bottom', () => {
    const { div, setScrollTop } = makeScrollDiv({ scrollHeight: 1000, clientHeight: 500, initialScrollTop: 0 });
    const ref = { current: div };
    const { result } = renderHook(() => useScrollToBottom(ref, 1));
    expect(result.current).toBe(false);

    act(() => {
      setScrollTop(499);
      div.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBe(true);
  });

  it('should flip to true when ResizeObserver fires and content now fits', () => {
    let scrollHeight = 1000;
    const div = document.createElement('div');
    document.body.appendChild(div);
    const clientHeight = 500;
    let scrollTop = 0;
    Object.defineProperty(div, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(div, 'clientHeight', { configurable: true, get: () => clientHeight });
    Object.defineProperty(div, 'scrollTop', { configurable: true, get: () => scrollTop });
    const ref = { current: div };

    const { result } = renderHook(() => useScrollToBottom(ref, 1));
    expect(result.current).toBe(false);

    act(() => {
      scrollHeight = 300;
      scrollTop = 0;
      capturedRoCallback([], {} as ResizeObserver);
    });

    expect(result.current).toBe(true);
  });

  it('should reset to false when resetKey changes and content overflows', () => {
    let scrollHeight = 400;
    const div = document.createElement('div');
    document.body.appendChild(div);
    let scrollTop = 0;
    const clientHeight = 500;
    Object.defineProperty(div, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(div, 'clientHeight', { configurable: true, get: () => clientHeight });
    Object.defineProperty(div, 'scrollTop', { configurable: true, get: () => scrollTop });
    const ref = { current: div };

    let key = 1;
    const { result, rerender } = renderHook(() => useScrollToBottom(ref, key));
    expect(result.current).toBe(true);

    act(() => {
      scrollHeight = 1000;
      scrollTop = 0;
      key = 2;
    });
    rerender();

    expect(result.current).toBe(false);
  });
});
