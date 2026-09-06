/**
 * Standalone Hocuspocus сервер.
 * Запуск: `tsx src/collab/server.ts` или через Docker COLLAB_PORT=3001.
 * Persistence: Yjs BLOB в PostgreSQL через @hocuspocus/extension-database.
 * Auth: JWT, выдаваемый /api/collab/token (HS256 от AUTH_SECRET).
 */
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Logger } from '@hocuspocus/extension-logger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/server/prisma';
import { env } from '@/env';

/** Минимальная HS256 JWT-верификация без внешних зависимостей. */
function verifyCollabJwt(token: string, secret: string): { uid: string; pid: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as {
      uid?: string;
      pid?: string;
      exp?: number;
    };
    if (!payload.uid || !payload.pid) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { uid: payload.uid, pid: payload.pid };
  } catch {
    return null;
  }
}

const server = Server.configure({
  port: env.COLLAB_PORT,
  extensions: [
    new Logger(),
    new Database({
      async fetch({ documentName }) {
        const doc = await prisma.yjsDocument.findUnique({ where: { projectId: documentName } });
        return doc?.data ?? null;
      },
      async store({ documentName, state }) {
        await prisma.yjsDocument.upsert({
          where: { projectId: documentName },
          create: { projectId: documentName, data: Buffer.from(state) },
          update: { data: Buffer.from(state), version: { increment: 1 } },
        });
      },
    }),
  ],
  async onAuthenticate({ token, documentName }) {
    if (!token) throw new Error('No token');
    const claims = verifyCollabJwt(token, env.AUTH_SECRET);
    if (!claims) throw new Error('Invalid token');
    if (claims.pid !== documentName) throw new Error('Token/document mismatch');

    const project = await prisma.project.findUnique({
      where: { id: documentName },
      select: {
        workspaceId: true,
        workspace: { select: { members: { where: { userId: claims.uid }, select: { role: true } } } },
      },
    });
    if (!project) throw new Error('Project not found');
    if (!project.workspace.members.length) throw new Error('Forbidden');

    return { userId: claims.uid, documentName };
  },
});

server.listen().then(() => {
  console.log(`[collab] hocuspocus listening on :${env.COLLAB_PORT}`);
});
