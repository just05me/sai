/**
 * WebhookService — outbound webhook delivery с HMAC-подписью (синхронно, без очереди).
 */
import { prisma } from '@/server/prisma';
import { webhookSignature } from '@/server/crypto';

type Event =
  | 'project.created'
  | 'project.updated'
  | 'node.changed'
  | 'sync.completed'
  | 'mind_map.generated'
  | 'comment.created';

export const WebhookService = {
  async dispatch(workspaceId: string, event: Event, payload: object) {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { workspaceId, active: true },
    });
    for (const ep of endpoints) {
      if (!ep.events.includes(event) && !ep.events.includes('*')) continue;
      await this.deliver(ep.id, event, payload);
    }
  },

  async deliver(endpointId: string, event: string, payload: object) {
    const ep = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
    if (!ep || !ep.active) return;
    const body = JSON.stringify(payload);
    const signature = webhookSignature(body, ep.secret);
    let status = 0;
    let responseBody = '';
    try {
      const r = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sai-Event': event,
          'X-Sai-Signature': signature,
          'User-Agent': 'Sai-Webhooks/1.0',
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      status = r.status;
      responseBody = await r.text();
    } catch (e) {
      status = 0;
      responseBody = String(e);
    }
    await prisma.webhookDelivery.create({
      data: {
        endpointId,
        event,
        payload: payload as object,
        status,
        responseBody: responseBody.slice(0, 2000),
        deliveredAt: status >= 200 && status < 300 ? new Date() : null,
      },
    });
    if (status < 200 || status >= 300) throw new Error(`webhook delivery failed: ${status}`);
  },
};
