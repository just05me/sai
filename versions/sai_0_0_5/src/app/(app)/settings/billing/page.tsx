import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { UsageTracker } from '@/server/services/usage-tracker';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isCloud } from '@/env';
import { Sparkles } from 'lucide-react';

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  });
  if (!member) return null;
  const snap = await UsageTracker.snapshot(member.workspaceId);

  return (
    <div className="container mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Подписка</h1>
        <Badge variant="secondary">{snap.plan}</Badge>
      </div>

      {!isCloud && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Self-host режим</CardTitle>
            <CardDescription>Биллинг отключён, лимитов нет. Для self-host Pro лицензии напишите hello@sai.app.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat label="Проекты" value={String(snap.projects)} limit={snap.limits.projects} />
        <Stat label="Узлы" value={String(snap.totalNodes)} limit={snap.limits.nodesPerProject * snap.projects || Infinity} />
        <Stat label="AI токены / мес" value={`${snap.tokens.toLocaleString('ru-RU')}`} />
      </div>

      {isCloud && snap.plan === 'FREE' && (
        <Card className="mt-6 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Перейти на Pro</CardTitle>
            <CardDescription>$12/мес · без лимита проектов · Idea Score · Pitch Deck · Time Travel</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/billing/checkout?plan=PRO" method="POST">
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Upgrade to Pro
              </button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, limit }: { label: string; value: string; limit?: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {limit !== undefined && Number.isFinite(limit) && (
        <div className="mt-2 text-xs text-muted-foreground">/ лимит {limit.toLocaleString('ru-RU')}</div>
      )}
    </div>
  );
}
