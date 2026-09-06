/**
 * PDF-воркер. Запускается в отдельном Docker-сервисе с Playwright + Chromium.
 * Тут — заглушка: реальная имплементация на ваш выбор печатает share-страницу
 * через playwright.chromium.launch().
 *
 * Это разделение даёт +600 МБ только когда профиль `pdf` активирован.
 */
import { prisma } from '@/server/prisma';

interface PdfJob {
  projectId: string;
  shareToken?: string;
  destinationKey: string;
}

export async function exportPdf(job: PdfJob) {
  console.log('[pdf] would render', job.projectId, '→', job.destinationKey);
  await prisma.project.findUnique({ where: { id: job.projectId } });
}
