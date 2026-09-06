'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { trpc } from '@/trpc-client';
import { cn } from '@/lib/utils';

interface Props {
  workspaceId: string;
  projectId: string;
  open: boolean;
  onClose: () => void;
  onNavigate: (nodeId: string, projectId: string) => void;
}

export function CanvasSearch({ workspaceId, projectId, open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchQuery = trpc.search.text.useQuery(
    { workspaceId, q: query },
    { enabled: query.length > 0, staleTime: 5000 },
  );

  const results = searchQuery.data ?? [];

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = useCallback(
    (idx: number) => {
      const node = results[idx];
      if (node) {
        onNavigate(node.id, node.projectId);
        onClose();
      }
    },
    [results, onNavigate, onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate(selectedIdx);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute left-1/2 top-4 z-50 w-full max-w-lg -translate-x-1/2">
      <div className="mx-4 rounded-xl border bg-popover shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Поиск по узлам…"
            className="h-auto border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
          />
          {searchQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {query.length > 0 && results.length > 0 && (
          <ul className="max-h-64 overflow-y-auto p-2" role="listbox">
            {results.map((node, i) => (
              <li
                key={node.id}
                role="option"
                aria-selected={i === selectedIdx}
                onClick={() => navigate(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  i === selectedIdx ? 'bg-accent' : 'hover:bg-accent/50',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{node.title}</div>
                  {node.description && (
                    <div className="truncate text-xs text-muted-foreground">{node.description}</div>
                  )}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {node.project.name}
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </li>
            ))}
          </ul>
        )}

        {query.length > 0 && !searchQuery.isFetching && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Ничего не найдено по «{query}»
          </div>
        )}
      </div>
    </div>
  );
}
