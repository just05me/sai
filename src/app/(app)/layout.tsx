import { auth } from '@/auth';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { prisma } from '@/server/prisma';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: { workspace: { select: { id: true, name: true, slug: true, kind: true, plan: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar
        user={{ id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? '', image: session.user.image ?? null }}
        workspaces={memberships.map((m) => ({ ...m.workspace, role: m.role }))}
      />
      <main className="flex-1 overflow-x-hidden">{children}</main>
      <CommandPalette />
    </div>
  );
}
