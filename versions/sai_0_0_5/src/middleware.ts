import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Sai middleware — selfhost only (без импорта @/auth).
 *
 * В selfhost-режиме авторизация не требуется: локальный пользователь
 * создаётся автоматически при первом обращении. Middleware пропускает
 * все запросы.
 *
 * Отказ от импорта @/auth продиктован Edge Runtime, который не
 * поддерживает Node.js-модули (stream из nodemailer, process.stdout
 * из logger).
 *
 * TODO: при переходе на cloud — вынести middleware-cloud.ts и
 * переключаться на уровне next.config.mjs.
 */
export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
