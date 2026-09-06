'use server';

import { redirect } from 'next/navigation';
import { ensureDefaultProject } from '@/server/local-user';

/**
 * Точка входа по кнопке «Попробовать»: гарантирует локального пользователя и
 * проект с тремя деревьями, затем сразу открывает холст (canvas + AI + дерево).
 */
export async function startApp(): Promise<void> {
  const projectId = await ensureDefaultProject();
  redirect(`/projects/${projectId}`);
}
