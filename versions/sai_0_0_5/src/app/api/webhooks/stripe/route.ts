/**
 * Stripe webhooks. Verify подпись + дёргаем BillingService.
 */
import { BillingService } from '@/server/services/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!BillingService.isEnabled()) return new Response('Billing disabled', { status: 404 });
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });
  const rawBody = await req.text();
  try {
    await BillingService.handleWebhook(rawBody, sig);
    return new Response(null, { status: 200 });
  } catch (e) {
    console.error('[stripe webhook]', e);
    return new Response(`Webhook error: ${e}`, { status: 400 });
  }
}
