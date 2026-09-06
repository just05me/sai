/**
 * BillingService — обёртка вокруг Stripe для Pro/Team планов (cloud-only).
 * В self-host режиме все функции no-op.
 */
import Stripe from 'stripe';
import { env, isCloud } from '@/env';
import { prisma } from '@/server/prisma';

// apiVersion не указываем — берётся версия, на которой собран установленный stripe SDK,
// что избавляет от рассинхрона типов и API.
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export const BillingService = {
  isEnabled: () => isCloud && stripe !== null,

  async createCheckoutSession(opts: {
    workspaceId: string;
    plan: 'PRO' | 'TEAM' | 'SELFHOST_PRO';
    successUrl: string;
    cancelUrl: string;
    email: string;
  }) {
    if (!stripe) throw new Error('Billing not configured');
    const priceId =
      opts.plan === 'PRO'
        ? env.STRIPE_PRICE_PRO
        : opts.plan === 'TEAM'
          ? env.STRIPE_PRICE_TEAM
          : env.STRIPE_PRICE_SELFHOST_PRO;
    if (!priceId) throw new Error(`No price configured for ${opts.plan}`);

    const billing = await prisma.billing.upsert({
      where: { workspaceId: opts.workspaceId },
      create: { workspaceId: opts.workspaceId },
      update: {},
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: billing.stripeCustomerId ?? undefined,
      customer_email: billing.stripeCustomerId ? undefined : opts.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      client_reference_id: opts.workspaceId,
      subscription_data: { metadata: { workspaceId: opts.workspaceId, plan: opts.plan } },
    });
    return session.url;
  },

  async handleWebhook(rawBody: string, sig: string) {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) throw new Error('webhook disabled');
    const event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.client_reference_id;
        if (workspaceId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await applySubscription(workspaceId, sub, session.customer as string | null);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const billing = await prisma.billing.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (billing) await applySubscription(billing.workspaceId, sub, null);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const billing = await prisma.billing.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (billing) {
          await prisma.workspace.update({
            where: { id: billing.workspaceId },
            data: { plan: 'FREE' },
          });
          await prisma.billing.update({
            where: { workspaceId: billing.workspaceId },
            data: { status: 'canceled', cancelAtPeriodEnd: true },
          });
        }
        break;
      }
    }
    return { received: true };
  },
};

/**
 * Безопасно достаёт current_period_end: на новых API оно живёт на subscription_items.
 */
function readPeriodEnd(sub: Stripe.Subscription): Date | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof top === 'number' && Number.isFinite(top)) return new Date(top * 1000);
  const items = sub.items?.data ?? [];
  const fromItem = items
    .map((i) => (i as unknown as { current_period_end?: number }).current_period_end)
    .find((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return typeof fromItem === 'number' ? new Date(fromItem * 1000) : null;
}

async function applySubscription(
  workspaceId: string,
  sub: Stripe.Subscription,
  customerId: string | null,
): Promise<void> {
  const plan = (sub.metadata?.plan as 'PRO' | 'TEAM' | 'SELFHOST_PRO' | undefined) ?? 'PRO';
  await prisma.workspace.update({ where: { id: workspaceId }, data: { plan } });
  await prisma.billing.update({
    where: { workspaceId },
    data: {
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: readPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      status: sub.status,
    },
  });
}
