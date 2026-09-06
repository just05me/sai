import Link from 'next/link';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TREE_META } from '@/lib/utils';
import { AnonImportHandler } from '@/components/anon-import-handler';
import { WorkspaceOnboarding } from '@/components/onboarding/workspace-onboarding';

export default async function WorkspacePage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const ck = await cookies();
  const wsId = ck.get('sai_ws')?.value;
  const member = wsId
    ? await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: wsId, userId: session.user.id } },
        include: { workspace: true },
      })
    : await prisma.workspaceMember.findFirst({
        where: { userId: session.user.id },
        include: { workspace: true },
        orderBy: { joinedAt: 'asc' },
      });
  if (!member) return null;

  const projects = await prisma.project.findMany({
    where: { workspaceId: member.workspaceId, archivedAt: null },
    orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    include: { _count: { select: { nodes: true } } },
  });

  return (
    <div className="container px-6 py-8">
      <Suspense fallback={null}>
        <AnonImportHandler />
      </Suspense>
      <WorkspaceOnboarding projectCount={projects.length} />
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{member.workspace.name}</h1>
          <p className="text-sm text-muted-foreground">{projects.length} проектов</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Новый проект
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <div className="text-4xl">🌱</div>
          <h2 className="mt-3 text-lg font-semibold">Создай первый проект или попробуй шаблон</h2>
          <p className="mt-1 text-sm text-muted-foreground">Подсказка: можно начать с Quick Capture — опиши идею одной фразой.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/projects/new"><Button>Новый проект</Button></Link>
            <Link href="/capture"><Button variant="outline">Quick Capture</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group rounded-2xl border bg-card p-5 transition hover:border-foreground/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {(['DEV', 'FUNC', 'BIZ'] as const).map((k) => (
                    <span
                      key={k}
                      className="h-1.5 w-6 rounded-full"
                      style={{ background: TREE_META[k].color }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3 font-semibold group-hover:underline">{p.name}</div>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              )}
              <div className="mt-4 text-xs text-muted-foreground">{p._count.nodes} узлов</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
