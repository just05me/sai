/**
 * Auth — selfhost-only: локальный пользователь без входа.
 */
import { getLocalSession, type LocalSession } from '@/server/local-user';

export type { LocalSession as Session };

export async function auth(): Promise<LocalSession | null> {
  return getLocalSession();
}
