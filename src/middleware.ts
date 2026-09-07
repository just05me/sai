import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Sai middleware — selfhost only (без импорта @/auth).
 *
 * Авторизация не требуется: локальный пользователь создаётся
 * автоматически при первом обращении, middleware пропускает все запросы.
 * @/auth не импортируем — Edge Runtime не поддерживает Node.js-модули.
 */
export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
