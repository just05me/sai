/**
 * Yjs клиент. Используется через хук useYDoc(projectId).
 * Создаёт HocuspocusProvider + IndexedDB локальный fallback.
 *
 * Токен для коллаб-сервера берётся через POST /api/collab/token и обновляется
 * автоматически по reconnect/exp (см. HocuspocusProvider.token-функцию).
 */
'use client';

import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';

const docs = new Map<string, { doc: Y.Doc; provider: HocuspocusProvider; idb: IndexeddbPersistence }>();

async function fetchCollabToken(projectId: string): Promise<string> {
  const r = await fetch('/api/collab/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
    credentials: 'include',
  });
  if (!r.ok) throw new Error(`collab token: ${r.status}`);
  const { token } = (await r.json()) as { token: string };
  return token;
}

export function getYDoc(projectId: string) {
  const existing = docs.get(projectId);
  if (existing) return existing;

  const doc = new Y.Doc();
  const idb = new IndexeddbPersistence(`sai-project-${projectId}`, doc);

  const wsUrl = process.env.NEXT_PUBLIC_COLLAB_URL ?? 'ws://localhost:3001';
  const provider = new HocuspocusProvider({
    url: wsUrl,
    name: projectId,
    document: doc,
    // HocuspocusProvider зовёт token() заново при каждом reconnect.
    token: () => fetchCollabToken(projectId),
  });

  const entry = { doc, provider, idb };
  docs.set(projectId, entry);
  return entry;
}

export function disposeYDoc(projectId: string) {
  const entry = docs.get(projectId);
  if (!entry) return;
  entry.provider.destroy();
  entry.idb.destroy();
  entry.doc.destroy();
  docs.delete(projectId);
}
