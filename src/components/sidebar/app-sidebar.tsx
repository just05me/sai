'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Compass,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/lib/store';

interface Props {
  user: { id: string; name: string | null; email: string; image: string | null };
  workspaces: Array<{ id: string; name: string; slug: string; kind: string; plan: string; role: string }>;
}

export function AppSidebar({ user, workspaces }: Props) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const collapsed = useCanvasStore((s) => s.sidebarCollapsed);
  const setCollapsed = useCanvasStore((s) => s.setSidebarCollapsed);

  const links = [
    { href: '/workspace', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/projects/new', label: t('projects'), icon: FolderTree },
    { href: '/explore', label: t('explore'), icon: Compass },
    { href: '/settings/keys', label: t('keys'), icon: KeyRound },
    { href: '/settings/billing', label: t('billing'), icon: Wallet },
    { href: '/settings', label: t('settings'), icon: Settings },
  ];

  const current = workspaces[0];

  if (collapsed) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setCollapsed(false)}
        aria-label="Развернуть панель"
        className="fixed left-4 top-3 z-50 h-9 w-9 shadow-md"
      >
        <PanelLeftOpen className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-col border-r bg-card/40">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Link href="/workspace" className="flex items-center gap-2 font-bold">
          <Sparkles className="h-5 w-5" /> Sai
        </Link>
        <div className="flex items-center gap-1">
          {current && (
            <Badge variant="secondary" className="text-[10px] uppercase">
              {current.plan}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed(true)}
            aria-label="Скрыть панель"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {current && (
        <div className="border-b px-4 py-3">
          <div className="text-xs text-muted-foreground">Workspace</div>
          <div className="truncate font-medium">{current.name}</div>
        </div>
      )}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary',
                active && 'bg-secondary font-medium',
              )}
            >
              <Icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="truncate text-xs text-muted-foreground">{user.name ?? 'Локальный режим'}</div>
      </div>
    </aside>
  );
}
