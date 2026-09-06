'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** Сторона, к которой примыкает панель: 'right' → ручка слева, 'left' → ручка справа. */
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  /** Ключ для сохранения ширины в localStorage. */
  storageKey?: string;
  className?: string;
  children: ReactNode;
}

export function ResizablePanel({
  side,
  defaultWidth,
  minWidth = 260,
  maxWidth = 820,
  storageKey,
  className,
  children,
}: Props) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(defaultWidth);
  const startXRef = useRef(0);
  const startWidthRef = useRef(defaultWidth);

  const clamp = useCallback(
    (w: number) => Math.min(maxWidth, Math.max(minWidth, w)),
    [minWidth, maxWidth],
  );

  const apply = useCallback((w: number) => {
    widthRef.current = w;
    setWidth(w);
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    const saved = Number(localStorage.getItem(storageKey));
    if (saved && !Number.isNaN(saved)) apply(clamp(saved));
  }, [storageKey, clamp, apply]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const delta =
        side === 'right' ? startXRef.current - e.clientX : e.clientX - startXRef.current;
      apply(clamp(startWidthRef.current + delta));
    },
    [side, clamp, apply],
  );

  const stopDrag = useCallback(() => {
    setDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDrag);
    if (storageKey) localStorage.setItem(storageKey, String(Math.round(widthRef.current)));
  }, [onPointerMove, storageKey]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = widthRef.current;
      setDragging(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopDrag);
    },
    [onPointerMove, stopDrag],
  );

  useEffect(() => () => stopDrag(), [stopDrag]);

  const resetWidth = () => apply(defaultWidth);

  return (
    <aside className={cn('relative', className)} style={{ width }}>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={startDrag}
        onDoubleClick={resetWidth}
        title="Потяните, чтобы изменить ширину (двойной клик — сброс)"
        className={cn(
          'group absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none',
          side === 'right' ? '-left-1' : '-right-1',
        )}
      >
        <div
          className={cn(
            'absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors',
            dragging ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/40',
          )}
        />
      </div>
      {children}
    </aside>
  );
}
