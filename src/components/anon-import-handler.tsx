'use client';

/**
 * Срабатывает на /workspace?import=anon — читает sai_anon_token из localStorage
 * и просит сервер развернуть Quick-Capture skeleton в реальный проект.
 * Удаляет ключи из localStorage и редиректит на проект.
 */
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export function AnonImportHandler() {
  const router = useRouter();
  const sp = useSearchParams();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (sp.get('import') !== 'anon') return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('sai_anon_token') : null;
    if (!token) return;
    ranRef.current = true;

    (async () => {
      try {
        const r = await fetch('/api/anon/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonToken: token }),
        });
        if (!r.ok) {
          toast.error('Не удалось импортировать anonymous Quick Capture');
          return;
        }
        const { projectId } = (await r.json()) as { projectId: string };
        localStorage.removeItem('sai_anon_token');
        localStorage.removeItem('sai_anon_skeleton');
        router.replace(`/projects/${projectId}`);
      } catch (e) {
        console.error(e);
        toast.error('Сеть недоступна, попробуй ещё раз');
      }
    })();
  }, [sp, router]);

  return null;
}
