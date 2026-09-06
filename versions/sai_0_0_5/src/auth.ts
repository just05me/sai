/**
 * Auth.js v5 — гибридная авторизация.
 *
 * - SAI_MODE=selfhost: локальный пользователь без входа (getLocalSession)
 * - SAI_MODE=cloud:    Auth.js с magic-link (Nodemailer) и OAuth (Google/GitHub)
 *
 * Экспорты `auth` / `signIn` / `signOut` / `handlers` совместимы с
 * существующими импортами.
 *
 * ВАЖНО: провайдеры (Google, GitHub, Nodemailer) загружаются динамически
 * только в cloud-режиме. Это нужно, чтобы middleware (Edge Runtime) не
 * упал на Node.js-модулях вроде `stream` из nodemailer.
 */
import type { DefaultSession } from 'next-auth';
import { env, isSelfHost } from '@/env';
import { getLocalSession, type LocalSession } from '@/server/local-user';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

// ── Lazy Auth.js (cloud only) ──────────────────────────────────────

let _nextAuth: Awaited<ReturnType<typeof import('next-auth').default>> | undefined;

async function getNextAuth() {
  if (_nextAuth) return _nextAuth;
  const [NextAuth, { PrismaAdapter }, { prisma }, { logger }, Google, GitHub, Nodemailer] =
    await Promise.all([
      import('next-auth').then((m) => m.default),
      import('@auth/prisma-adapter'),
      import('@/server/prisma'),
      import('@/server/logger'),
      import('next-auth/providers/google').then((m) => m.default),
      import('next-auth/providers/github').then((m) => m.default),
      import('next-auth/providers/nodemailer').then((m) => m.default),
    ]);

  const providers: ReturnType<typeof Google>[] = [];

  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }),
    );
  }

  if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({ clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET }),
    );
  }

  // Email magic link — всегда доступен в cloud-режиме
  if (!isSelfHost) {
    const emailConfig: Record<string, unknown> = {
      from: env.EMAIL_FROM || 'Sai <no-reply@sai.local>',
    };
    if (env.EMAIL_SERVER_HOST) {
      emailConfig.server = {
        host: env.EMAIL_SERVER_HOST,
        port: env.EMAIL_SERVER_PORT,
        auth: {
          user: env.EMAIL_SERVER_USER,
          pass: env.EMAIL_SERVER_PASSWORD,
        },
      };
    }
    providers.push(Nodemailer(emailConfig));
  }

  _nextAuth = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: providers.length > 0
      ? providers
      : [
          // Минимум один провайдер нужен для инициализации Auth.js
          Nodemailer({ from: env.EMAIL_FROM || 'Sai <no-reply@sai.local>' }),
        ],
    session: { strategy: 'jwt' },
    pages: {
      signIn: '/signin',
      verifyRequest: '/verify-request',
      error: '/signin',
    },
    callbacks: {
      session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub;
        }
        return session;
      },
      signIn({ user }) {
        logger.info({ userId: user.id, email: user.email }, 'User signed in');
        return true;
      },
    },
  });

  return _nextAuth;
}

// ── Экспорты для API-роутов (cloud only) ───────────────────────────

export const handlers = {
  GET: async (...args: any[]) => {
    const na = await getNextAuth();
    return na.handlers.GET(...args);
  },
  POST: async (...args: any[]) => {
    const na = await getNextAuth();
    return na.handlers.POST(...args);
  },
};

export async function signIn(...args: any[]) {
  const na = await getNextAuth();
  return (na.signIn as Function)(...args);
}

export async function signOut(...args: any[]) {
  const na = await getNextAuth();
  return (na.signOut as Function)(...args);
}

// ── Unified auth() — selfhost или cloud ────────────────────────────

export async function auth(): Promise<LocalSession | null> {
  if (isSelfHost) {
    return getLocalSession();
  }
  try {
    const na = await getNextAuth();
    const session = await na.auth();
    if (!session?.user?.id) return null;
    return {
      user: {
        id: session.user.id,
        name: session.user.name ?? 'User',
        email: session.user.email ?? '',
        image: session.user.image ?? null,
      },
      expires: session.expires,
    };
  } catch {
    return null;
  }
}
