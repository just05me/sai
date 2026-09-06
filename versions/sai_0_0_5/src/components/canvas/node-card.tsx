'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertCircle, Beaker, CheckCircle2, CircleDashed, Pause } from 'lucide-react';
import { cn, TREE_META, type TreeKey } from '@/lib/utils';

export interface SaiNodeData extends Record<string, unknown> {
  title: string;
  description?: string | null;
  status: 'IDEA' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  treeKind: TreeKey;
  hypothesisStatus: 'NONE' | 'UNTESTED' | 'TESTING' | 'VALIDATED' | 'INVALIDATED';
  healthScore?: number;
  isFocused?: boolean;
  isSelected?: boolean;
}

const STATUS_ICON = {
  IDEA: CircleDashed,
  IN_PROGRESS: Pause,
  DONE: CheckCircle2,
  BLOCKED: AlertCircle,
};

const STATUS_COLOR = {
  IDEA: 'text-muted-foreground',
  IN_PROGRESS: 'text-blue-500',
  DONE: 'text-emerald-500',
  BLOCKED: 'text-rose-500',
};

function NodeCardImpl({ data, selected }: NodeProps) {
  const d = data as SaiNodeData;
  const Icon = STATUS_ICON[d.status];
  const meta = TREE_META[d.treeKind];

  const handleBase =
    '!h-3 !w-3 !rounded-full !border-2 !border-background !opacity-0 !transition-opacity group-hover:!opacity-100';

  return (
    <div
      className={cn(
        'group relative w-60 rounded-xl border-2 bg-card p-3 shadow-sm transition',
        'animate-grow-node hover:shadow-md',
        (selected || d.isSelected) && 'ring-2 ring-ring',
        d.isFocused && 'scale-105',
      )}
      style={{ borderColor: meta.color }}
      data-tree={d.treeKind}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleBase)}
        style={{ background: meta.color }}
      />
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
        <span>{meta.label}</span>
        {d.hypothesisStatus !== 'NONE' && (
          <span className="ml-auto inline-flex items-center gap-1 rounded bg-amber-500/10 px-1 text-amber-700 dark:text-amber-300">
            <Beaker className="h-3 w-3" />
            {d.hypothesisStatus}
          </span>
        )}
      </div>
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', STATUS_COLOR[d.status])} />
        <div className="flex-1">
          <div className="font-medium leading-tight">{d.title}</div>
          {d.description ? (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.description}</div>
          ) : (
            <div className="mt-1 text-xs italic text-muted-foreground/60">нет описания</div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleBase)}
        style={{ background: meta.color }}
      />
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
NodeCard.displayName = 'NodeCard';
