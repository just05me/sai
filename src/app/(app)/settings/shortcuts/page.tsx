import { HOTKEYS } from '@/lib/hotkeys';
import { Badge } from '@/components/ui/badge';

export default function ShortcutsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Хоткеи</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Кастомизация переназначения — в v1.5 (F-220). Сейчас отображены значения по умолчанию.
      </p>
      <div className="mt-6 divide-y rounded-xl border bg-card">
        {HOTKEYS.map((h) => (
          <div key={h.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium">{h.description}</div>
              <Badge variant="outline" className="mt-1 text-[10px]">{h.scope}</Badge>
            </div>
            <kbd className="rounded bg-secondary px-2 py-1 text-xs">{h.combo}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
