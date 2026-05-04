import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

function atBottomCheck(el: HTMLElement): boolean {
  return el.scrollHeight - el.clientHeight - el.scrollTop <= 2;
}

export function useScrollToBottom(
  scrollRef: RefObject<HTMLElement | null>,
  resetKey: unknown,
): boolean {
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    setAtBottom(false);
    const el = scrollRef.current;
    if (!el) return;

    setAtBottom(atBottomCheck(el));
    const check = () => setAtBottom(atBottomCheck(el));

    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  // scrollRef is a stable ref object; resetKey drives re-attachment per ticket
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return atBottom;
}
