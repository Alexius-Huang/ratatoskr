import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

type Props = {
  left: ReactNode;
  right: ReactNode | null;
  storageKey: string;
  minLeftPx?: number;
  minRightPx?: number;
  defaultRatio?: number;
};

const DIVIDER_PX = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readStoredRatio(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1 ? parsed : fallback;
}

export function SplitPane({
  left,
  right,
  storageKey,
  minLeftPx = 240,
  minRightPx = 240,
  defaultRatio = 0.6,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = useState(() => readStoredRatio(storageKey, defaultRatio));
  const [containerWidth, setContainerWidth] = useState(0);
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (!target.hasPointerCapture(e.pointerId)) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const next = clamp(x / rect.width, minLeftPx / rect.width, 1 - minRightPx / rect.width);
        setRatio(next);
      });
    },
    [minLeftPx, minRightPx],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, String(ratio));
  }, [ratio, storageKey]);

  if (right === null) {
    return <div className="flex-1 min-h-0 flex">{left}</div>;
  }

  const leftPx =
    containerWidth > 0
      ? clamp(
          ratio * containerWidth,
          minLeftPx,
          Math.max(minLeftPx, containerWidth - minRightPx - DIVIDER_PX),
        )
      : null;

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 flex relative"
      style={{ touchAction: 'none' }}
    >
      <div
        className="min-w-0 overflow-hidden"
        style={{
          width: leftPx !== null ? `${leftPx}px` : `${ratio * 100}%`,
          flexShrink: 0,
        }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-1 cursor-col-resize bg-nord-3 hover:bg-nord-8 active:bg-nord-8 transition-colors shrink-0"
      />
      <div className="flex-1 min-w-0 overflow-hidden">{right}</div>
    </div>
  );
}
