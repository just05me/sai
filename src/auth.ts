/**
 * Auth — selfhost-only: локальный пользователь без входа.
 */
import { getLocalSession, type LocalSession } from '@/server/local-user';

export type { LocalSession as Session };

export async function auth(): Promise<LocalSession | null> {
  return getLocalSession();
}

export const handlers = {
  GET: async () => new Response('Auth disabled in selfhost mode', { status: 404 }),
  POST: async () => new Response('Auth disabled in selfhost mode', { status: 404 }),
};

export async function signIn(): Promise<never> {
  throw new Error('signIn unavailable in selfhost mode');
}

export async function signOut(): Promise<never> {
  throw new Error('signOut unavailable in selfhost mode');
}
