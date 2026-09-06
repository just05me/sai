import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { BillingService } from '@/server/services/billing';
import { env } from '@/env';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!BillingService.isEnabled()) return new Response('Billing disabled', { status: 404 });
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const plan = url.searchParams.get('plan');
  if (!plan || !['PRO', 'TEAM', 'SELFHOST_PRO'].includes(plan)) return new Response('Bad plan', { status: 400 });

  const member = await prisma.workspaceMember.findFirst({ where: { userId: session.user.id }, include: { workspace: true } });
  if (!member) return new Response('No workspace', { status: 400 });

  const checkoutUrl = await BillingService.createCheckoutSession({
    workspaceId: member.workspaceId,
    plan: plan as 'PRO' | 'TEAM' | 'SELFHOST_PRO',
    successUrl: `${env.NEXT_PUBLIC_APP_URL}/settings/billing?status=success`,
    cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/settings/billing?status=cancel`,
    email: session.user.email ?? '',
  });
  if (!checkoutUrl) {
    return new Response('Stripe did not return a checkout URL', { status: 502 });
  }
  return Response.redirect(checkoutUrl, 303);
}
