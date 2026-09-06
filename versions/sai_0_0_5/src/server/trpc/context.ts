import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { ensureLocalUser } from '@/server/local-user';

export async function createContext() {
  const session = await auth();
  const ck = await cookies();
  // В локальном режиме без входа cookie `sai_ws` не выставляется, поэтому
  // по умолчанию активным считаем единственный workspace локального пользователя.
  const activeWorkspaceId = ck.get('sai_ws')?.value ?? (await ensureLocalUser());
  return { prisma, session, activeWorkspaceId };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
