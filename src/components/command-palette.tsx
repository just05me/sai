'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { Compass, FolderTree, KeyRound, Plus, Search, Settings, Sparkles } from 'lucide-react';
import { HOTKEYS } from '@/lib/hotkeys';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useHotkeys('mod+k, /', (e) => {
    e.preventDefault();
    setOpen((o) => !o);
  });
  useHotkeys('esc', () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-28"
      onClick={() => setOpen(false)}
    >
      <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <Command className="overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Что нужно сделать?"
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
              Ничего не нашлось
            </Command.Empty>
            <Command.Group heading="Навигация" className="text-xs text-muted-foreground">
              <Item icon={<FolderTree className="h-4 w-4" />} label="Все проекты" onSelect={() => (router.push('/workspace'), setOpen(false))} />
              <Item icon={<Plus className="h-4 w-4" />} label="Новый проект" onSelect={() => (router.push('/projects/new'), setOpen(false))} />
              <Item icon={<Compass className="h-4 w-4" />} label="Explore" onSelect={() => (router.push('/explore'), setOpen(false))} />
              <Item icon={<Sparkles className="h-4 w-4" />} label="Quick Capture" onSelect={() => (router.push('/capture'), setOpen(false))} />
              <Item icon={<KeyRound className="h-4 w-4" />} label="API-ключи (BYOK)" onSelect={() => (router.push('/settings/keys'), setOpen(false))} />
              <Item icon={<Settings className="h-4 w-4" />} label="Настройки" onSelect={() => (router.push('/settings'), setOpen(false))} />
            </Command.Group>
            <Command.Group heading="Хоткеи" className="text-xs text-muted-foreground">
              {HOTKEYS.slice(0, 10).map((h) => (
                <Command.Item
                  key={h.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm aria-selected:bg-secondary"
                >
                  <span>{h.description}</span>
                  <kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{h.combo}</kbd>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function Item({ icon, label, onSelect }: { icon: React.ReactNode; label: string; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-secondary"
    >
      {icon}
      {label}
    </Command.Item>
  );
}
