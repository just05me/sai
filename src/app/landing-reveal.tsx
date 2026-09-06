'use client';

import { useEffect } from 'react';

/**
 * Подсветка блоков при скролле для лендинга. Навешивает IntersectionObserver на
 * все элементы с [data-reveal] и выставляет им data-visible="true". При
 * prefers-reduced-motion сразу показывает всё.
 */
export function LandingReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!els.length) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      els.forEach((el) => el.setAttribute('data-visible', 'true'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).setAttribute('data-visible', 'true');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
