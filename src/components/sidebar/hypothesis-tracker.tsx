'use client';

import { Beaker, CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { trpc } from '@/trpc-client';

const STATUS_META = {
  UNTESTED: { label: 'Не проверена', icon: Hourglass, color: 'text-amber-500' },
  TESTING: { label: 'В тесте', icon: Beaker, color: 'text-blue-500' },
  VALIDATED: { label: 'Подтверждена', icon: CheckCircle2, color: 'text-emerald-500' },
  INVALIDATED: { label: 'Опровергнута', icon: XCircle, color: 'text-rose-500' },
} as const;

interface Props {
  workspaceId: string;
  projectId: string;
}

export function HypothesisTracker({ workspaceId, projectId }: Props) {
  const { data, isLoading } = trpc.hypotheses.list.useQuery({ workspaceId, projectId });

  return (
    <ResizablePanel
      side="left"
      defaultWidth={288}
      minWidth={240}
      maxWidth={640}
      storageKey="panel-width:hypotheses"
      className="flex shrink-0 flex-col border-r bg-card/40"
    >
      <header className="border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Beaker className="h-4 w-4" />
          Гипотезы
        </div>
        <p className="text-xs text-muted-foreground">Untested → Testing → Validated/Invalidated</p>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading && <div className="text-xs text-muted-foreground">Загрузка…</div>}
        {data?.length === 0 && (
          <div className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
            Превратите узел в гипотезу через панель редактирования.
          </div>
        )}
        {data?.map((h) => {
          const meta = STATUS_META[h.status as keyof typeof STATUS_META] ?? STATUS_META.UNTESTED;
          const Icon = meta.icon;
          return (
            <div key={h.id} className="rounded-md border bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                {meta.label}
              </div>
              <div className="mt-1 text-sm font-medium leading-tight">{h.node.title}</div>
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{h.question}</div>
              {h.learnings && (
                <div className="mt-2 rounded bg-secondary p-2 text-[11px] text-muted-foreground">
                  ✦ {h.learnings}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ResizablePanel>
  );
}
