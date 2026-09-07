'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TREE_META, type TreeKey } from '@/lib/utils';

interface SkeletonResponse {
  anonToken: string;
  skeleton: {
    trees: Array<{
      kind: TreeKey;
      root: { title: string; description?: string };
      children: Array<{ title: string; description?: string }>;
    }>;
  };
}

export default function CapturePage() {
  const t = useTranslations('capture');
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState<SkeletonResponse | null>(null);
  const [loading, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai/quick-capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          toast.error(j.message ?? 'Не удалось сгенерировать карту');
          return;
        }
        const data = (await res.json()) as SkeletonResponse;
        setResult(data);
      } catch {
        toast.error('Сеть недоступна');
      }
    });
  };

  const openOnCanvas = (anonToken: string) => {
    startTransition(async () => {
      try {
        const r = await fetch('/api/anon/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonToken }),
        });
        if (!r.ok) {
          toast.error('Не удалось открыть карту на холсте');
          return;
        }
        const { projectId } = (await r.json()) as { projectId: string };
        router.push(`/projects/${projectId}`);
      } catch {
        toast.error('Сеть недоступна');
      }
    });
  };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        Sai · Quick Capture
      </div>

      {!result ? (
        <form onSubmit={submit} className="space-y-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={500}
            placeholder={t('placeholder')}
            rows={4}
            required
            autoFocus
            className="text-base"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{idea.length}/500 · {t('continueAnon')}</span>
            <Button type="submit" disabled={loading || idea.length < 3}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              {loading ? t('loading') : t('submit')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Карта готова. Девять узлов на трёх деревьях.
          </h1>
          <div className="grid gap-4 md:grid-cols-3">
            {result.skeleton.trees.map((tree) => (
              <div
                key={tree.kind}
                className="rounded-2xl border bg-card p-4"
                style={{ borderTopColor: TREE_META[tree.kind].color, borderTopWidth: 3 }}
              >
                <div className="text-sm font-semibold text-muted-foreground">
                  {TREE_META[tree.kind].label}
                </div>
                <div className="mt-3 font-medium">{tree.root.title}</div>
                {tree.root.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{tree.root.description}</p>
                )}
                <ul className="mt-3 space-y-2">
                  {tree.children.map((c, i) => (
                    <li key={i} className="rounded-md bg-secondary px-2 py-1 text-sm">
                      {c.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              disabled={loading}
              onClick={() => openOnCanvas(result.anonToken)}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Открыть на холсте
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setResult(null)} disabled={loading}>
              Попробовать ещё раз
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
