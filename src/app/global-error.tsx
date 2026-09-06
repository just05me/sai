'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="ru">
      <body className="bg-background text-foreground antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Критическая ошибка</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {error.message || 'Приложение не может продолжить работу. Попробуйте перезагрузить страницу.'}
            </p>
            {error.digest && (
              <p className="mt-1 text-xs text-muted-foreground">ID ошибки: {error.digest}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Перезагрузить
            </Button>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              На главную
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
