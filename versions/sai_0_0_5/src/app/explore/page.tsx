import Link from 'next/link';
import { prisma } from '@/server/prisma';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 600;

export default async function ExplorePage() {
  const templates = await prisma.template.findMany({
    where: { scope: 'PUBLIC' },
    orderBy: [{ rating: 'desc' }, { forkCount: 'desc' }],
    take: 60,
  });
  return (
    <main className="container mx-auto max-w-6xl px-6 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-bold">
        <Sparkles className="h-4 w-4" /> Sai
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Витрина публичных проектов и шаблонов. Каждая карточка — индексируемая страница.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t.category ?? 'general'}</div>
            <h3 className="mt-2 text-lg font-semibold">{t.name}</h3>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t.rating.toFixed(1)} · {t.forkCount} форков</span>
              <Link href={`/explore/${t.id}`} className="font-medium text-primary hover:underline">Открыть →</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
