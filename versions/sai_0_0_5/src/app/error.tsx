'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold">Что-то пошло не так</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {error.message || 'Произошла непредвиденная ошибка. Попробуйте обновить страницу.'}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-muted-foreground">ID ошибки: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Попробовать снова
      </Button>
    </div>
  );
}
