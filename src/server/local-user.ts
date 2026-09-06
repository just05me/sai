/**
 * Локальный режим без регистрации.
 *
 * Sai Web запускается как персональное приложение: вместо авторизации через
 * Auth.js используется единственный «локальный» пользователь, который при первом
 * обращении автоматически создаётся в БД вместе с персональным workspace.
 *
 * Это повторяет поведение десктоп-версий (0.0.1–0.0.4): открыл — и сразу работаешь,
 * без входа и регистрации.
 */
import { TreeKind } from '@prisma/client';
import { prisma } from '@/server/prisma';

const DEBUG_RUN_ID = 'pre-fix';

function getDatabaseDebugTarget(): Record<string, unknown> {
  const rawUrl = process.env.DATABASE_URL;
  const base = {
    hasDatabaseUrl: Boolean(rawUrl),
    nodeEnv: process.env.NODE_ENV ?? null,
    saiMode: process.env.SAI_MODE ?? null,
  };

  if (!rawUrl) return base;

  try {
    const parsed = new URL(rawUrl);
    return {
      ...base,
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || null,
      usesLocalhost: ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname),
    };
  } catch (error) {
    return {
      ...base,
      parseError: error instanceof Error ? error.name : typeof error,
    };
  }
}

function getErrorDebugData(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: typeof error };

  const prismaError = error as Error & { code?: unknown; clientVersion?: unknown };
  return {
    name: error.name,
    message: error.message,
    code: prismaError.code ?? null,
    clientVersion: prismaError.clientVersion ?? null,
  };
}

function agentDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
): void {
  fetch('http://127.0.0.1:7537/ingest/2380dc06-4407-4b07-803e-ccacd40f8c13', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '468319' },
    body: JSON.stringify({
      sessionId: '468319',
      runId: DEBUG_RUN_ID,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

export const LOCAL_USER_ID = 'local-user';
export const LOCAL_USER_EMAIL = 'local@sai.local';
export const LOCAL_USER_NAME = 'Локальный пользователь';
export const LOCAL_WORKSPACE_SLUG = 'local';

export interface LocalSession {
  user: { id: string; name: string; email: string; image: string | null };
  expires: string;
}

/** Стабильная «вечная» сессия локального пользователя. */
function buildSession(): LocalSession {
  return {
    user: {
      id: LOCAL_USER_ID,
      name: LOCAL_USER_NAME,
      email: LOCAL_USER_EMAIL,
      image: null,
    },
    // далёкая дата — сессия не истекает
    expires: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  };
}

// Провижининг идемпотентен и достаточно дорог (несколько запросов в БД),
// поэтому кешируем факт инициализации на время жизни процесса.
let provisioned = false;
let provisioning: Promise<string> | null = null;

/**
 * Гарантирует существование локального пользователя, его workspace и членства.
 * Возвращает id workspace.
 */
export async function ensureLocalUser(): Promise<string> {
  // #region agent log
  agentDebugLog('H1,H3,H4', 'src/server/local-user.ts:ensureLocalUser.entry', 'ensureLocalUser entry', {
    provisioned,
    hasProvisioningPromise: Boolean(provisioning),
    databaseTarget: getDatabaseDebugTarget(),
  });
  // #endregion

  if (provisioned) {
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: LOCAL_USER_ID },
      orderBy: { joinedAt: 'asc' },
      select: { workspaceId: true },
    });
    if (member) return member.workspaceId;
    provisioned = false; // данные пропали — провижионим заново
  }
  if (provisioning) return provisioning;

  provisioning = (async () => {
    // #region agent log
    agentDebugLog('H1,H2,H3,H4', 'src/server/local-user.ts:before-user-upsert', 'before local user upsert', {
      databaseTarget: getDatabaseDebugTarget(),
    });
    // #endregion

    try {
      await prisma.user.upsert({
        where: { id: LOCAL_USER_ID },
        update: {},
        create: {
          id: LOCAL_USER_ID,
          name: LOCAL_USER_NAME,
          email: LOCAL_USER_EMAIL,
          emailVerified: new Date(),
        },
      });

      let member = await prisma.workspaceMember.findFirst({
        where: { userId: LOCAL_USER_ID },
        orderBy: { joinedAt: 'asc' },
        select: { workspaceId: true },
      });

      if (!member) {
        const ws = await prisma.workspace.upsert({
          where: { slug: LOCAL_WORKSPACE_SLUG },
          update: {},
          create: {
            slug: LOCAL_WORKSPACE_SLUG,
            name: 'Мои проекты',
            kind: 'PERSONAL',
            ownerId: LOCAL_USER_ID,
          },
          select: { id: true },
        });
        member = await prisma.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: ws.id, userId: LOCAL_USER_ID } },
          update: {},
          create: { workspaceId: ws.id, userId: LOCAL_USER_ID, role: 'OWNER' },
          select: { workspaceId: true },
        });
      }

      provisioned = true;
      // #region agent log
      agentDebugLog('H2,H5', 'src/server/local-user.ts:provision-success', 'local provisioning succeeded', {
        workspaceIdPresent: Boolean(member.workspaceId),
      });
      // #endregion
      return member.workspaceId;
    } catch (error) {
      // #region agent log
      agentDebugLog('H1,H2,H3,H4,H5', 'src/server/local-user.ts:provision-error', 'local provisioning failed', {
        databaseTarget: getDatabaseDebugTarget(),
        error: getErrorDebugData(error),
      });
      // #endregion
      throw error;
    }
  })();

  try {
    return await provisioning;
  } finally {
    provisioning = null;
  }
}

/** Возвращает сессию локального пользователя, попутно гарантируя его наличие в БД. */
export async function getLocalSession(): Promise<LocalSession> {
  await ensureLocalUser();
  return buildSession();
}

/**
 * Гарантирует наличие хотя бы одного проекта и возвращает id того, который нужно
 * открыть по клику «Попробовать»: последний обновлённый, либо свежесозданный
 * с тремя деревьями (DEV / FUNC / BIZ).
 */
export async function ensureDefaultProject(): Promise<string> {
  const workspaceId = await ensureLocalUser();

  const existing = await prisma.project.findFirst({
    where: { workspaceId, archivedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const project = await prisma.project.create({
    data: {
      workspaceId,
      name: 'Моя идея',
      emoji: '🌱',
      createdById: LOCAL_USER_ID,
    },
    select: { id: true },
  });
  await prisma.tree.createMany({
    data: Object.values(TreeKind).map((kind) => ({ projectId: project.id, kind })),
  });
  return project.id;
}
