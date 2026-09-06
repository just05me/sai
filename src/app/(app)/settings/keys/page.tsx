import { KeySetupWizard } from '@/components/key-setup-wizard';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';

export const dynamic = 'force-dynamic';

export default async function KeysPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  });
  if (!member) return null;
  return (
    <div className="container mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">BYOK — твои API-ключи</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sai не берёт наценку на токены. Ключи шифруются <strong>AES-256-GCM</strong> в браузере перед отправкой.
      </p>
      <div className="mt-8">
        <KeySetupWizard workspaceId={member.workspaceId} userId={session.user.id} />
      </div>
    </div>
  );
}
