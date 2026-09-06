/**
 * Email-воркер: immediate для @mention, дневной digest для остального.
 * Self-host: если ни Resend, ни SMTP не настроены — gracefully no-op.
 */
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from '@/env';
import { prisma } from '@/server/prisma';

interface EmailJob {
  userId: string;
  kind: string;
  payload: Record<string, unknown>;
}

/** HTML-escape: payload и kind приходят от пользователя → защита от stored XSS в письме. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const transport = env.EMAIL_SERVER_HOST
  ? nodemailer.createTransport({
      host: env.EMAIL_SERVER_HOST,
      port: env.EMAIL_SERVER_PORT,
      auth: env.EMAIL_SERVER_USER
        ? { user: env.EMAIL_SERVER_USER, pass: env.EMAIL_SERVER_PASSWORD! }
        : undefined,
    })
  : null;

export async function sendEmail(job: EmailJob) {
  const user = await prisma.user.findUnique({ where: { id: job.userId } });
  if (!user?.email) return;

  const subject = `Sai · ${job.kind}`;
  const html = `<p>У вас новое событие в Sai: <strong>${escapeHtml(job.kind)}</strong></p><pre>${escapeHtml(
    JSON.stringify(job.payload, null, 2),
  )}</pre>`;

  if (resend) {
    await resend.emails.send({ from: env.EMAIL_FROM, to: user.email, subject, html });
  } else if (transport) {
    await transport.sendMail({ from: env.EMAIL_FROM, to: user.email, subject, html });
  } else {
    console.log('[email] no transport configured, skipped:', job.kind, user.email);
  }
}
