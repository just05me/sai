import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { ProjectWorkspace } from '@/components/canvas/project-workspace';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  const session = await auth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      trees: true,
      workspace: { include: { members: { where: { userId: session.user.id } } } },
    },
  });

  if (!project) notFound();
  if (project.workspace.members.length === 0) notFound();

  const ck = await cookies();
  if (ck.get('sai_ws')?.value !== project.workspaceId) {
    // в реальном приложении — переключаем активный workspace; здесь просто прокидываем
  }

  return (
    <ProjectWorkspace
      project={{
        id: project.id,
        name: project.name,
        workspaceId: project.workspaceId,
        trees: project.trees.map((t) => ({ kind: t.kind, rootId: t.rootId })),
      }}
    />
  );
}
