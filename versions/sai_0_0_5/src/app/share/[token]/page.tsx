import { notFound } from 'next/navigation';
import { ShareService } from '@/server/services/share';
import { prisma } from '@/server/prisma';
import { TREE_META } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ password?: string }>;
}

export default async function SharePage({ params, searchParams }: Props) {
  const { token } = await params;
  const search = searchParams ? await searchParams : {};
  const result = await ShareService.resolve(token, search.password);
  if (!result) notFound();

  if (result.needsPassword) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <form className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">Защищено паролем</h1>
          <input
            type="password"
            name="password"
            placeholder="Пароль"
            className="mt-4 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Открыть
          </button>
        </form>
      </main>
    );
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: result.link!.projectId },
    include: {
      trees: true,
      nodes: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  });

  return (
    <main className="container mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <div className="text-xs text-muted-foreground">Публичный просмотр · Made with Sai</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{project.name}</h1>
        {project.description && <p className="mt-2 text-muted-foreground">{project.description}</p>}
      </header>
      <div className="grid gap-6 md:grid-cols-3">
        {(['DEV', 'FUNC', 'BIZ'] as const).map((kind) => {
          const tree = project.trees.find((t) => t.kind === kind);
          const nodes = tree ? project.nodes.filter((n) => n.treeId === tree.id) : [];
          return (
            <div key={kind} className="rounded-2xl border bg-card p-4" style={{ borderTopColor: TREE_META[kind].color, borderTopWidth: 3 }}>
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                {TREE_META[kind].label}
              </div>
              <ul className="mt-3 space-y-2">
                {nodes.map((n) => (
                  <li key={n.id} className="rounded-md bg-secondary/50 p-2 text-sm">
                    <div className="font-medium">{n.title}</div>
                    {n.description && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.description}</div>}
                  </li>
                ))}
                {nodes.length === 0 && <li className="text-xs text-muted-foreground">— пусто —</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <footer className="mt-12 border-t pt-4 text-center text-xs text-muted-foreground">
        <a href="/" className="hover:underline">Made with Sai</a>
      </footer>
    </main>
  );
}
