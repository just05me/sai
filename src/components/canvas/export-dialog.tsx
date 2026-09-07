'use client';

import { useState } from 'react';
import { Bot, Download, FileText, FileType, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn, TREE_META, type TreeKey } from '@/lib/utils';

type Format = 'md' | 'pdf' | 'txt';
type Audience = 'human' | 'ai';

const TREE_KEYS: TreeKey[] = ['DEV', 'FUNC', 'BIZ'];

const FORMATS: { value: Format; label: string; hint: string; icon: typeof FileText }[] = [
  { value: 'md', label: 'Markdown', hint: 'файл .md', icon: FileText },
  { value: 'pdf', label: 'PDF', hint: 'файл .pdf', icon: FileType },
  { value: 'txt', label: 'TXT', hint: 'простой текст', icon: FileText },
];

const AUDIENCES: { value: Audience; label: string; hint: string; icon: typeof Users }[] = [
  { value: 'human', label: 'ТЗ для людей', hint: 'разделы по деревьям', icon: Users },
  { value: 'ai', label: 'ТЗ для ИИ', hint: 'единый промпт из всех деревьев', icon: Bot },
];

interface Props {
  projectId: string;
  projectName: string;
}

export function ExportDialog({ projectId, projectName }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>('md');
  const [audience, setAudience] = useState<Audience>('human');
  const [selectedTrees, setSelectedTrees] = useState<TreeKey[]>([...TREE_KEYS]);

  const toggleTree = (kind: TreeKey) => {
    setSelectedTrees((prev) => {
      if (prev.includes(kind)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== kind);
      }
      return [...prev, kind];
    });
  };

  const handleExport = () => {
    const params = new URLSearchParams({
      format,
      audience,
      trees: selectedTrees.join(','),
    });
    const url = `/api/export/${projectId}?${params.toString()}`;
    const suffix = audience === 'ai' ? '-prompt' : '';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}${suffix}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Download className="mr-1 h-4 w-4" />
          Экспорт
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Экспорт ТЗ</DialogTitle>
          <DialogDescription>
            {audience === 'ai'
              ? 'Выбранные деревья будут объединены в одно классическое ТЗ с промптом для ИИ.'
              : 'Выберите тип документа, деревья и формат файла.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Тип документа</p>
          <div className="grid grid-cols-2 gap-2">
            {AUDIENCES.map((a) => {
              const Icon = a.icon;
              const active = audience === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                    active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4" />
                    {a.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Деревья</p>
          <div className="flex flex-wrap gap-2">
            {TREE_KEYS.map((kind) => {
              const active = selectedTrees.includes(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleTree(kind)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                    active ? 'border-primary bg-primary/5' : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: TREE_META[kind].color }}
                  />
                  {TREE_META[kind].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Формат</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const active = format === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors',
                    active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-[11px] text-muted-foreground">{f.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleExport} disabled={selectedTrees.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            Экспортировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
